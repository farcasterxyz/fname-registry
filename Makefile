# Lists `make <cmd>` shortcuts which are easier to type than the full command.

ifeq ($(CI), true)
	EARTHLY_INTERACTIVE_ARGS := --ci
	CMD_TYPE := cmd
	CI_ARGS := --CI=true
else
	EARTHLY_INTERACTIVE_ARGS := --interactive
	CMD_TYPE := interactive-cmd
	CI_ARGS :=
endif

ifeq ($(release),)
	release=
	RELEASE_ARGS := --release=$(shell node -e "console.log(new Date().toISOString().replace(/\:/g,'-').replace(/\./g,'-'))")
endif

REF_ARGS := --fname_registry_commit_ref=$(shell git rev-parse HEAD)

ifdef pod
	POD_ARGS := pod:$(pod)
else
	POD_ARGS :=
endif

CMD_PREFIX := earthly --env-file-path /dev/null --max-remote-cache

# Builds (but doesn't publish) the current Docker image specified by fname_registry_commit_ref in the Earthfile and outputs it locally.
.PHONY: build
build:
	$(CMD_PREFIX) $(EARTHLY_INTERACTIVE_ARGS) +fname-registry-prod $(REF_ARGS) $(CI_ARGS)

# Builds and publishes the current Docker image specified by fname_registry_commit_ref in the Earthfile
.PHONY: publish
publish:
	$(CMD_PREFIX) --push +fname-registry-prod $(REF_ARGS)

# Shows what infrastructure changes will be applied on the next deploy, if any.
.PHONY: plan
plan:
	$(CMD_PREFIX) --ci --no-output +cmd $(RELEASE_ARGS) $(REF_ARGS) --CI=true --args="plan $(POD_ARGS)"

# Applies any infrastructure changes without carrying out the rest of the deploy
# process (note: this could still result in a "deploy" if updating ASGs).
.PHONY: apply
apply: publish
	$(CMD_PREFIX) $(EARTHLY_INTERACTIVE_ARGS) --no-output +$(CMD_TYPE) $(RELEASE_ARGS) $(REF_ARGS) $(CI_ARGS) --args="deploy --apply-only --yes $(POD_ARGS)"

# Applies any infrastructure changes (if any) and carries out a deploy.
.PHONY: deploy
deploy: publish
	$(CMD_PREFIX) $(EARTHLY_INTERACTIVE_ARGS) --no-output +$(CMD_TYPE) $(RELEASE_ARGS) $(REF_ARGS) $(CI_ARGS) --args="deploy --yes $(POD_ARGS)"

# DANGEROUS. Deletes infrastructure.
.PHONY: destroy
destroy:
	$(CMD_PREFIX) $(EARTHLY_INTERACTIVE_ARGS) --no-output +$(CMD_TYPE) $(RELEASE_ARGS) $(REF_ARGS) $(CI_ARGS) --args="destroy --yes $(POD_ARGS)"

# Validates configuration files, reporting any issues.
.PHONY: lint
lintit:
	$(CMD_PREFIX) $(EARTHLY_INTERACTIVE_ARGS) --no-output +$(CMD_TYPE) $(RELEASE_ARGS) $(REF_ARGS) $(CI_ARGS) --args="lint"

# Open an SSH console to the specified pod.
#
# e.g. `make ssh pod=mypod`
.PHONY: ssh
ssh:
	$(CMD_PREFIX) --no-output +$(CMD_TYPE) $(RELEASE_ARGS) $(REF_ARGS) --args="console $(POD_ARGS)"
