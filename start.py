import os
import time
import subprocess
import sys
import shutil
import argparse
import re

# --- CONFIGURATION ---
ENV_VARS = os.environ.copy()
# Fake credentials for LocalStack (injected only into this process)
ENV_VARS["AWS_ACCESS_KEY_ID"] = "test"
ENV_VARS["AWS_SECRET_ACCESS_KEY"] = "test"
ENV_VARS["AWS_DEFAULT_REGION"] = "eu-central-1"
ENV_VARS["AWS_ENDPOINT_URL"] = "http://localhost:4566"
# Fabric Network Paths
NETWORK_PATH = os.path.join(".", "microservices", "filiera360", "network")
CHAINCODE_PATH = os.path.join(".", "microservices", "filiera360", "chaincode")

def run_command(command, allow_fail=False):
    """Executes a shell command. If allow_fail is True, errors are ignored."""
    try:
        # shell=True only for Windows compatibility
        subprocess.check_call(command, env=ENV_VARS, shell=sys.platform == 'win32')
    except subprocess.CalledProcessError:
        if allow_fail:
            print(f"   ⚠️ Command failed or resource exists, continuing: {' '.join(command[:2])}...")
        else:
            print(f"❌ Critical Error executing: {' '.join(command)}")
            sys.exit(1)

def check_prerequisites():
    print("🔍 Checking prerequisites...")
    tools = ["docker", "kind", "kubectl", "awslocal"]
    for tool in tools:
        if not shutil.which(tool):
            print(f"❌ Error: tool '{tool}' is missing from PATH.")
            sys.exit(1)
    print("✅ Prerequisites OK.")

def generate_fabric_artifacts():
    """
    Generates crypto-config and genesis block using a Docker container.
    This avoids OS-specific binaries issues.
    """
    print("\n🔗 [Blockchain] Generating Crypto Material (Dockerized)...")
    
    # Clean up old artifacts
    shutil.rmtree(os.path.join(NETWORK_PATH, "crypto-config"), ignore_errors=True)
    shutil.rmtree(os.path.join(NETWORK_PATH, "channel-artifacts"), ignore_errors=True)
    os.makedirs(os.path.join(NETWORK_PATH, "channel-artifacts"), exist_ok=True)

    # Command to run cryptogen and configtxgen inside a container
    # We mount the network folder to /data inside the container
    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{NETWORK_PATH}:/data",
        "-e", "FABRIC_CFG_PATH=/data",
        "hyperledger/fabric-tools:2.5", 
        "/bin/bash", "-c", 
        """
        echo '   - Generating Certs...' &&
        cryptogen generate --config=/data/crypto-config.yaml --output=/data/crypto-config &&
        
        echo '   - Generating Genesis Block...' &&
        configtxgen -profile OneOrgOrdererGenesis -channelID system-channel -outputBlock /data/channel-artifacts/genesis.block &&
        
        echo '   - Generating Channel Tx...' &&
        configtxgen -profile OneOrgChannel -outputCreateChannelTx /data/channel-artifacts/mychannel.tx -channelID mychannel &&
        
        echo '   - Generating Anchor Peers...' &&
        configtxgen -profile OneOrgChannel -outputAnchorPeersUpdate /data/channel-artifacts/Org1MSPanchors.tx -channelID mychannel -asOrg Org1MSP
        """
    ]
    
    run_command(docker_cmd)
    print("✅ Blockchain Artifacts Generated.")

def setup_blockchain_channel():
    print("\n🔗 [Blockchain] Initializing Channel & Smart Contract...")
    
    # 1. Wait for Peer AND Orderer to be ready
    print("   - Waiting for peer0-org1 and orderer...")
    run_command(["kubectl", "wait", "--for=condition=ready", "pod", "-l", "app=peer0-org1", "--timeout=90s"])
    run_command(["kubectl", "wait", "--for=condition=ready", "pod", "-l", "app=orderer", "--timeout=90s"]) # AGGIUNTO

    orderer_ca = "/fabric/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    # --- FIX: Path all'MSP dell'ADMIN ---
    # In k8s il path parte da /fabric/crypto-config/...
    admin_msp = "/fabric/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"

    # Sleep di sicurezza per assestamento rete
    time.sleep(5)

    # 2. Esecuzione Comandi (Create -> Join -> Anchor Update)
    print("   - Creating & Joining Channel (with TLS)...")
    
    commands = [
        # CREAZIONE CANALE: Usiamo 'export ... && peer ...' per diventare Admin temporaneamente
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && peer channel create -o orderer:7050 -c mychannel -f /fabric/channel-artifacts/mychannel.tx --outputBlock /fabric/channel-artifacts/mychannel.block --tls --cafile {orderer_ca}",
        
        # JOIN CANALE: Anche qui usiamo Admin per coerenza, anche se basterebbe il Peer user
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && peer channel join -b /fabric/channel-artifacts/mychannel.block",
        
        # UPDATE ANCHOR PEERS: Richiede tassativamente Admin
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && peer channel update -o orderer:7050 -c mychannel -f /fabric/channel-artifacts/Org1MSPanchors.tx --tls --cafile {orderer_ca}"
    ]

    for cmd in commands:
        print(f"     Exec step...") 
        # Rimosso allow_fail=True: se fallisce la creazione canale, lo script deve fermarsi!
        run_command(["kubectl", "exec", "deploy/peer0-org1", "--", "sh", "-c", cmd], allow_fail=False)

    print("✅ Blockchain Network Active.")

def deploy_chaincode():
    print("\n📜 [Blockchain] Deploying Chaincode 'filiera360'...")
    
    # 1. Trova il nome del Pod Peer
    peer_pod = subprocess.check_output(
        ["kubectl", "get", "pod", "-l", "app=peer0-org1", "-o", "jsonpath={.items[0].metadata.name}"], 
        env=ENV_VARS
    ).decode("utf-8").strip()
    print(f"   - Peer Pod found: {peer_pod}")
    
    cc_name = "filiera360"
    cc_version = "1.0"
    cc_sequence = "1"
    base_path = "/opt/gopath/src/github.com/chaincode_source"
    orderer_ca = "/fabric/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    admin_msp = "/fabric/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"

    # 2. Copia sorgente (Pulizia preventiva)
    print("   - Copying source code...")
    run_command(["kubectl", "exec", peer_pod, "--", "rm", "-rf", base_path], allow_fail=True)
    run_command(["kubectl", "exec", peer_pod, "--", "mkdir", "-p", base_path])
    
    # Copia i file locali nel pod
    run_command(["kubectl", "cp", "./microservices/filiera360/chaincode", f"{peer_pod}:{base_path}"])
    
    # --- RILEVAMENTO AUTOMATICO DEL PERCORSO ---
    print("   - Detecting package.json path...")
    # Controlliamo se kubectl cp ha creato una sottocartella 'chaincode'
    check_nested = ["kubectl", "exec", peer_pod, "--", "test", "-f", f"{base_path}/chaincode/package.json"]
    try:
        subprocess.check_call(check_nested, env=ENV_VARS, stderr=subprocess.DEVNULL)
        final_cc_path = f"{base_path}/chaincode"
        print(f"     -> Found nested structure. Using path: {final_cc_path}")
    except:
        final_cc_path = base_path
        print(f"     -> Found flat structure. Using path: {final_cc_path}")
    # -------------------------------------------

    # 3. Package
    print("   - Packaging...")
    run_command(["kubectl", "exec", peer_pod, "--", "peer", "lifecycle", "chaincode", "package", f"{cc_name}.tar.gz", 
                 "--path", final_cc_path, # Usiamo il path rilevato dinamicamente
                 "--lang", "node", 
                 "--label", f"{cc_name}_{cc_version}"])
    
    # 4. Install (as Admin)
    print("   - Installing (as Admin)...")
    install_cmd = [
        "kubectl", "exec", peer_pod, "--", "sh", "-c",
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && "
        f"peer lifecycle chaincode install {cc_name}.tar.gz"
    ]
    run_command(install_cmd)
    
    # 5. Get Package ID
    print("   - Querying Package ID...")
    query_cmd = [
        "kubectl", "exec", peer_pod, "--", "sh", "-c",
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && "
        "peer lifecycle chaincode queryinstalled"
    ]
    result = subprocess.check_output(query_cmd, env=ENV_VARS).decode("utf-8")
    
    match = re.search(f"{cc_name}_{cc_version}:[a-zA-Z0-9]+", result)
    if not match:
        print(f"❌ Error: Package ID not found in output:\n{result}")
        sys.exit(1)
    package_id = match.group(0)
    print(f"     ID: {package_id}")
    
    # 6. Approve
    print("   - Approving (Org1)...")
    approve_cmd = [
        "kubectl", "exec", peer_pod, "--", "sh", "-c",
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && "
        f"peer lifecycle chaincode approveformyorg -o orderer:7050 --ordererTLSHostnameOverride orderer.example.com "
        f"--channelID mychannel --name {cc_name} --version {cc_version} --package-id {package_id} "
        f"--sequence {cc_sequence} --tls --cafile {orderer_ca}"
    ]
    run_command(approve_cmd)
    
    # 7. Commit
    print("   - Committing...")
    commit_cmd = [
        "kubectl", "exec", peer_pod, "--", "sh", "-c",
        f"export CORE_PEER_MSPCONFIGPATH={admin_msp} && "
        f"peer lifecycle chaincode commit -o orderer:7050 --ordererTLSHostnameOverride orderer.example.com "
        f"--channelID mychannel --name {cc_name} --version {cc_version} --sequence {cc_sequence} "
        f"--tls --cafile {orderer_ca}"
    ]
    run_command(commit_cmd)
    
    print("✅ Chaincode Deployed Successfully.")

def start_infrastructure():
    generate_fabric_artifacts()

    print("\n📦 [1/4] Starting LocalStack...")
    run_command(["docker-compose", "up", "-d"])
    
    print("⏳ Waiting for LocalStack availability...")
    # Simple wait loop could be improved with a health check, but sleep is safe for artifacts
    time.sleep(10) 

    print("\n☁️ [2/4] Provisioning AWS Resources (Idempotent)...")
    
    # allow_fail=True ensures script doesn't crash if bucket/repo already exists
    print("   - Ensure S3 Bucket 'ecofood-backup' exists")
    run_command(["awslocal", "s3", "mb", "s3://ecofood-backup"], allow_fail=True)
    
    print("   - Ensure ECR Repo 'metaverso' exists")
    run_command(["awslocal", "ecr", "create-repository", "--repository-name", "metaverso"], allow_fail=True)
    
    print("   - Ensure Secrets exist")
    run_command(["awslocal", "secretsmanager", "create-secret", 
                 "--name", "EcoFoodChain/Prod/DBCredentials", 
                 "--secret-string", '{"username":"postgres","password":"securepassword123"}'], allow_fail=True)

    print("\n☸️ [3/4] Setting up Kubernetes (Kind)...")
    # Check if cluster exists to avoid error
    result = subprocess.run(["kind", "get", "clusters"], capture_output=True, text=True)
    if "ecofood-cluster" not in result.stdout:
        config_content = f"""
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraMounts:
  - hostPath: {NETWORK_PATH}
    containerPath: /tmp/fabric-network
    # NOTE: hostPath used for prototype reproducibility; in future work this
# will be replaced with LocalStack-backed persistent storage
  - hostPath: /var/run/docker.sock
    containerPath: /var/run/docker.sock
"""
        with open("kind-config.yaml", "w") as f:
            f.write(config_content)
            
        run_command(["kind", "create", "cluster", "--name", "ecofood-cluster", "--config", "kind-config.yaml"])
        os.remove("kind-config.yaml")
    else:
        print("   - Cluster 'ecofood-cluster' already active.")

    

    print("\n🏗️ [4/4] Build & Deploy...")


    run_command(["docker", "build", "-t", "ecofoodchain/frontend:latest", "./microservices/frontend"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/frontend:latest", "--name", "ecofood-cluster"])

    
    run_command(["docker", "build", "-t", "ecofoodchain/metaverso:latest", "./microservices/metaverso"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/metaverso:latest", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/filiera-frontend:latest", "./microservices/filiera360/frontend"])
    run_command(["docker", "build", "-t", "ecofoodchain/filiera-backend:latest", "./microservices/filiera360/backend"])
    run_command(["docker", "build", "-t", "ecofoodchain/filiera-middleware:latest", "./microservices/filiera360/middleware"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-backend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-middleware:latest", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/refood-frontend:latest", "./microservices/refood/frontend"])
    run_command(["docker", "build", "-t", "ecofoodchain/refood-backend:latest", "./microservices/refood/backend"])
    run_command(["docker", "build", "-t", "ecofoodchain/refood-db:latest", "./microservices/refood"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-backend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-db:latest", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/buildform4:latest", "./microservices/3dguide"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/buildform4:latest", "--name", "ecofood-cluster"])
    
    run_command(["docker", "build", "-t", "ecofoodchain/chatbot-frontend:latest", "-f",  "./microservices/chatbot/Dockerfile.frontend", "./microservices/chatbot"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/chatbot-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["docker", "build", "-t", "ecofoodchain/chatbot-backend:latest", "-f", "./microservices/chatbot/Dockerfile.backend", "./microservices/chatbot"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/chatbot-backend:latest", "--name", "ecofood-cluster"])

    # Pull & Load Middleware external images
    print("   🚚 Loading Mongo & Fabric images...")
    external_images = ["mongo:5.0", "hyperledger/fabric-peer:2.5", "hyperledger/fabric-orderer:2.5"]
    for img in external_images:
         run_command(["docker", "pull", img])
         run_command(["kind", "load", "docker-image", img, "--name", "ecofood-cluster"])

    print("   - Applying Manifests...")
    run_command(["kubectl", "apply", "-f", "k8s/", "--recursive"])
    # to ignore other services for now:
    #run_command(["kubectl", "apply", "-f", "k8s/"])
    #run_command(["kubectl", "apply", "-f", "k8s/chatbot/"])

    # --- BLOCKCHAIN POST-DEPLOYMENT STEPS ---
    # --- FIX DEADLOCK: RESET FORZATO PER CARICARE CERTIFICATI E LIBERARE PORTE ---
    print("\n🔄 [Blockchain] Resetting nodes to load new certificates & fix HostPort...")

    # 1. Riavvia Orderer (non ha hostPort, quindi rollout va bene)
    print("   - Restarting Orderer...")
    run_command(["kubectl", "rollout", "restart", "deployment/orderer"], allow_fail=True)

    # 2. RESET PEER: Scale a 0 per liberare la porta 7052 (Deadlock prevention)
    print("   - Stopping Peer (Scaling to 0) to release port 7052...")
    run_command(["kubectl", "scale", "deployment/peer0-org1", "--replicas=0"], allow_fail=True)
    
    # Aspetta che il vecchio pod muoia davvero
    print("   - Waiting for Peer to terminate...")
    run_command(["kubectl", "wait", "--for=delete", "pod", "-l", "app=peer0-org1", "--timeout=60s"], allow_fail=True)

    # 3. Riaccendi il Peer
    print("   - Starting Peer (Scaling to 1)...")
    run_command(["kubectl", "scale", "deployment/peer0-org1", "--replicas=1"])

    # 4. Attesa che tutto sia pronto (Rollout status è più sicuro di wait pod)
    print("   ⏳ Waiting for Fabric nodes to be fully ready...")
    run_command(["kubectl", "rollout", "status", "deployment/orderer", "--timeout=120s"])
    run_command(["kubectl", "rollout", "status", "deployment/peer0-org1", "--timeout=120s"])
    time.sleep(5)
    setup_blockchain_channel()
    deploy_chaincode()
    run_command(["kubectl", "rollout", "restart", "deployment/filiera-middleware"], allow_fail=True)

    print("   - Installing Ingress Controller (Nginx)...")
    run_command(["kubectl", "apply", "-f", "https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml"], allow_fail=True)

    print("\n✅ ENVIRONMENT READY!")
    print("   Run 'kubectl get pods' to check status.")
    print("   - Waiting for Ingress Controller to be ready (may take 30s)...")
    run_command(["kubectl", "wait", "--namespace", "ingress-nginx", 
                 "--for=condition=ready", "pod", 
                 "--selector=app.kubernetes.io/component=controller", 
                 "--timeout=90s"], allow_fail=True)
    
    cmd = ["kubectl", "port-forward", "--namespace=ingress-nginx", "service/ingress-nginx-controller", "8080:80"]
    # if this part fails, don't destroy the infrastructure: wait some minutes and print:
    # kubectl port-forward --namespace=ingress-nginx service/ingress-nginx-controller 8080:80
    subprocess.run(cmd, check=True)

def destroy_infrastructure():
    print("\n💥 DESTROYING Simulation Environment...")
    
    print("   - Deleting Kubernetes Cluster...")
    # allow_fail=True because maybe the cluster isn't there
    run_command(["kind", "delete", "cluster", "--name", "ecofood-cluster"], allow_fail=True)
    
    print("   - Stopping LocalStack...")
    run_command(["docker-compose", "down"], allow_fail=True)
    
    print("✅ Cleanup complete. Environment is clean.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EcoFoodChain Artifact Manager")
    parser.add_argument("action", choices=["start", "destroy", "deploy-cc"], help="Action to perform")
    
    # If no arguments provided, print help
    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
        
    args = parser.parse_args()
    
    check_prerequisites()
    
    if args.action == "start":
        start_infrastructure()
    elif args.action == "destroy":
        destroy_infrastructure()
    elif args.action == "deploy-cc":
        deploy_chaincode()