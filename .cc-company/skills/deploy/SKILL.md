---
name: deploy
description: 배포 프로세스 관리
---

# Deploy Skill

Manages deployment processes including CI/CD pipelines, deployment scripts, and rollback strategies.

## Capabilities
- CI/CD pipeline configuration (GitHub Actions, GitLab CI, CircleCI)
- Container deployment (Docker, Kubernetes)
- Serverless deployment (Vercel, Netlify, AWS Lambda)
- Environment variable and secrets management
- Blue-green and canary deployment strategies

## Safety Checks Before Deployment
1. All tests passing
2. Build artifacts generated successfully
3. Environment variables configured
4. Database migrations ready (if applicable)
5. Rollback plan documented

## Commands This Skill Enables
- Deploy to staging/production
- Rollback to previous version
- Check deployment status
- View deployment logs
