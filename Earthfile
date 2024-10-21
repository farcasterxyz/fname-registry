VERSION --run-with-aws 0.8
PROJECT farcasterxyz/fname-registry
FROM alpine:3.20.3
WORKDIR /workspace

ARG --global --required fname_registry_commit_ref
ARG --global docker_registry=526236635984.dkr.ecr.us-east-1.amazonaws.com/farcasterxyz/fname-registry
ARG --global FNAME_REGISTRY_DOCKER_IMAGE=$docker_registry:$fname_registry_commit_ref

fname-registry-repo:
  COPY . .
  SAVE ARTIFACT /workspace /workspace

fname-registry-prod:
  FROM DOCKERFILE -f +fname-registry-repo/workspace/Dockerfile +fname-registry-repo/workspace/*
  SAVE IMAGE --push $FNAME_REGISTRY_DOCKER_IMAGE

stack-repo:
  ARG stack_repo_git_url=git@github.com:warpcast/stack # Must use SSH since private
  ARG stack_repo_commit_ref=main
  GIT CLONE --branch $stack_repo_commit_ref $stack_repo_git_url /repo
  SAVE ARTIFACT /repo /repo

workspace:
  FROM DOCKERFILE -f +stack-repo/repo/Dockerfile +stack-repo/repo/*
  CACHE --sharing locked --persist /usr/src/app/workspace/cdktf.out
  COPY +fname-registry-repo/workspace /usr/src/app/workspace
  ARG CI
  ENV CI=$CI
  ENV FNAME_REGISTRY_DOCKER_IMAGE=$FNAME_REGISTRY_DOCKER_IMAGE
  # OTEL is enabled by default by Earthly but causes crashes. Disable since we don't use
  # See https://github.com/earthly/earthly/issues/4260
  ENV OTEL_METRICS_EXPORTER=none
  ENV OTEL_TRACES_EXPORTER=none

interactive-cmd:
  FROM +workspace
  ARG args
  RUN --interactive --no-cache --ssh \
    --secret AWS_ACCESS_KEY_ID --secret AWS_SECRET_ACCESS_KEY \
    bun cli.js --workdir ./workspace $args

cmd:
  FROM +workspace
  ARG args
  RUN --no-cache --ssh \
    --secret AWS_ACCESS_KEY_ID --secret AWS_SECRET_ACCESS_KEY \
    bun cli.js --workdir ./workspace $args
