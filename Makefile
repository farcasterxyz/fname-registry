# Lists `make <cmd>` shortcuts which are easier to type than the full command.

docker_registry := 526236635984.dkr.ecr.us-east-1.amazonaws.com/farcasterxyz/fname-registry
commit_ref := $(shell git rev-parse HEAD)
docker_image := $(docker_registry):$(commit_ref)

ifeq ($(release),)
	RELEASE_ARGS := --release=$(shell date +"%Y-%m-%dT%H-%M-%Sz")-$(shell git rev-parse --short HEAD)
else
	RELEASE_ARGS :=
endif

# Builds (but doesn't publish) the current Docker image
.PHONY: build
build:
	docker build --tag $(docker_image) -f Dockerfile .

# Builds and publishes the current Docker image
.PHONY: publish
publish:
	docker build --tag $(docker_image) -f Dockerfile --push .

.PHONY: assert-published
assert-published:
	docker manifest inspect $(docker_image)

# Shows what infrastructure changes will be applied on the next deploy, if any.
.PHONY: plan
plan:
	STACK_DOCKER_IMAGE=$(docker_image) stack plan --yes $(RELEASE_ARGS) $(POD_ARGS)

# Applies any infrastructure changes without carrying out the rest of the deploy
# process (note: this could still result in a "deploy" if updating ASGs).
.PHONY: apply
apply: assert-published
	STACK_DOCKER_IMAGE=$(docker_image) stack deploy --apply-only --yes $(RELEASE_ARGS) $(POD_ARGS)

# Applies any infrastructure changes (if any) and carries out a deploy.
.PHONY: deploy
deploy: assert-published
	STACK_DOCKER_IMAGE=$(docker_image) stack deploy --yes $(RELEASE_ARGS) $(POD_ARGS)

# DANGEROUS. Deletes infrastructure.
.PHONY: destroy
destroy:
	STACK_DOCKER_IMAGE=$(docker_image) stack destroy $(POD_ARGS)

# Validates configuration files, reporting any issues.
.PHONY: lint-stack
lint-stack:
	STACK_DOCKER_IMAGE=$(docker_image) stack lint

# Open an SSH console to the specified pod.
#
# e.g. `make ssh pod=mypod`
.PHONY: ssh
ssh:
	STACK_DOCKER_IMAGE=$(docker_image) stack console $(POD_ARGS)
