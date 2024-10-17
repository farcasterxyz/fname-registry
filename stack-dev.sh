#!/bin/bash

# Useful for testing local changes to `stack`.
#
# DON'T use unless you understand what you are doing.
#
# Requires:
#
# - Stack repo checked out in a sibling directory to this repo
# - SSH key that is authorized to access the hubs
# - ssh-agent with that key loaded and SSH_AUTH_SOCK set in your shell
# - AWS credentials allowing read-only access to our AWS account
#   stored in ~/.aws/credentials

set -euo pipefail

docker build -t stack -f ../stack/Dockerfile ../stack/.

aws_access_key_id=$(cat ~/.aws/credentials | sed -n 's/.*aws_access_key_id\s*=\s*\([a-zA-Z0-9+-_]*\).*/\1/p')
aws_secret_access_key=$(cat ~/.aws/credentials | sed -n 's/.*aws_secret_access_key\s*=\s*\([a-zA-Z0-9+-_]*\).*/\1/p')

docker run --rm -it \
  -v$(pwd):/usr/src/app/workspace \
  -e AWS_ACCESS_KEY_ID=$aws_access_key_id \
  -e AWS_SECRET_ACCESS_KEY=$aws_secret_access_key \
  -v $SSH_AUTH_SOCK:/ssh-agent \
  -e SSH_AUTH_SOCK=/ssh-agent \
  stack "$@"
