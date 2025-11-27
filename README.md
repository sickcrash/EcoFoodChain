# Cloud-Native Infrastructure Simulation Artifact

## Abstract
This repository contains the software artifact associated with the paper regarding **Taming Heterogeneity in Post-Industry 4.0: Orchestrating AI, VR, and DLT within a Unified Microservices Architecture**.

It provides a fully reproducible environment to simulate a microservices architecture orchestrated by **Kubernetes** (emulating AWS EKS) and integrated with simulated **AWS services** (via LocalStack). This artifact demonstrates the feasibility of the architectural model described in the paper without incurring public cloud costs.

To ensure this artifact is strictly reproducible on any review machine (Windows, macOS, Linux) and without any licenses costs.

Research Environment: Relies on Amazon Elastic Kubernetes Service (EKS) for a managed control plane. Uses Amazon Elastic Container Registry (ECR) where images are pushed and then pulled by nodes.
Artifact Implementation: Uses Kind (Kubernetes in Docker) and Direct Image Loading.

## Architecture Overview
The simulated environment replicates the following production components:

* **Cloud Provider Emulation**: LocalStack (https://localstack.cloud/) is used to mock AWS services such as S3 (backup), ECR (registry), and IAM.
* **Orchestration**: A local Kubernetes cluster simulates the Amazon EKS control plane.
* **Persistence**: PostgreSQL deployed as a `StatefulSet` with Persistent Volumes, simulating cloud-native storage behavior.
* **Workloads**: Containerized microservices communicating via internal ClusterIP services.

## Repository Structure
* `microservices/`: Source code and Dockerfiles for the application modules.
* `k8s/`: Kubernetes manifests (Deployments, Services, StatefulSets, Ingress).
* `docker-compose.yml`: Configuration to start the LocalStack emulation layer.


## Reproducibility Instructions

### Prerequisites
Ensure the following tools are installed on the host machine:
* Docker & Docker Compose
* Python 3.x
* Kind (Kubernetes in Docker)
* kubectl
* AWS CLI (optional, for debugging purposes)

When everything is ready:
python3 start.py start

To delete the whole environment:
python3 start.py destroy  