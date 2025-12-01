import os
import time
import subprocess
import sys
import shutil
import argparse

# --- CONFIGURATION ---
ENV_VARS = os.environ.copy()
# Fake credentials for LocalStack (injected only into this process)
ENV_VARS["AWS_ACCESS_KEY_ID"] = "test"
ENV_VARS["AWS_SECRET_ACCESS_KEY"] = "test"
ENV_VARS["AWS_DEFAULT_REGION"] = "eu-central-1"
ENV_VARS["AWS_ENDPOINT_URL"] = "http://localhost:4566"

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

def start_infrastructure():
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
        run_command(["kind", "create", "cluster", "--name", "ecofood-cluster"])
    else:
        print("   - Cluster 'ecofood-cluster' already active.")

    print("\n🏗️ [4/4] Build & Deploy...")


    run_command(["docker", "build", "-t", "ecofoodchain/frontend:latest", "./microservices/frontend"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/frontend:latest", "--name", "ecofood-cluster"])

    
    run_command(["docker", "build", "-t", "ecofoodchain/metaverso:latest", "./microservices/metaverso"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/metaverso:latest", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/filiera-frontend:latest", "./microservices/filiera360/frontend"])
    run_command(["docker", "build", "-t", "ecofoodchain/filiera-backend:latest", "./microservices/filiera360/backend"])
    run_command(["docker", "build", "-t", "ecofoodchain/filiera-middleware:latest", "./microservices/filiera360/blockchain/chaincode/myapp"])
    run_command(["docker", "pull", "mongo:5.0"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-backend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/filiera-middleware:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "mongo:5.0", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/refood-frontend:latest", "./microservices/refood/frontend"])
    run_command(["docker", "build", "-t", "ecofoodchain/refood-backend:latest", "./microservices/refood/backend"])
    run_command(["docker", "build", "-t", "ecofoodchain/refood-db:latest", "./microservices/refood"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-backend:latest", "--name", "ecofood-cluster"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/refood-db:latest", "--name", "ecofood-cluster"])

    run_command(["docker", "build", "-t", "ecofoodchain/buildform4:latest", "./microservices/buildform4"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/buildform4:latest", "--name", "ecofood-cluster"])
    
    run_command(["docker", "build", "-t", "ecofoodchain/chatbot-frontend:latest", "-f",  "./microservices/chatbot/Dockerfile.frontend", "./microservices/chatbot"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/chatbot-frontend:latest", "--name", "ecofood-cluster"])
    run_command(["docker", "build", "-t", "ecofoodchain/chatbot-backend:latest", "-f", "./microservices/chatbot/Dockerfile.backend", "./microservices/chatbot"])
    run_command(["kind", "load", "docker-image", "ecofoodchain/chatbot-backend:latest", "--name", "ecofood-cluster"])


    print("   - Applying Manifests...")
    run_command(["kubectl", "apply", "-f", "k8s/", "--recursive"])
    # to ignore other services for now:
    #run_command(["kubectl", "apply", "-f", "k8s/"])
    #run_command(["kubectl", "apply", "-f", "k8s/chatbot/"])

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
    parser.add_argument("action", choices=["start", "destroy"], help="Action to perform")
    
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