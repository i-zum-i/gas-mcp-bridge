#!/bin/sh
# husky

# Created by Husky v9.1.7

# Any
#   \`. \$(dirname -- "\$0")/\_/husky.sh\`
# in your hook, will source this file and run node.

# Node
#   `node_modules/husky/run.js`
# will be run.

# You can run husky scripts directly
#   `node_modules/husky/run.js pre-commit`

# That's all, folks!
#
# For more information, see https://typicode.github.io/husky

# ---

# Node install paths
# https://nodejs.org/api/all.html#all_modules_loading_from_the_node_modules_folders
#
# ---
#
# `npm root`
#
# > /Users/typicode/project/node_modules
#
# `pnpm root`
#
# > /Users/typicode/project/node_modules
#
# `yarn berry root`
#
# > /Users/typicode/project
#
# `yarn classic root`
#
# > /Users/typicode/project/node_modules

# Find the node_modules directory
#
# yarn berry
#   YARN_PROJECT_ROOT is defined
#   `$YARN_PROJECT_ROOT/.yarn/sdks/husky/node_modules`
#
# pnpm
#   PNPM_SCRIPT_SRC_DIR is defined
#   `cd $PNPM_SCRIPT_SRC_DIR`
#   `cd ..`
#   `npm root`
#
# others
#   `npm root`

# On Linux, `readlink -f` will realpath node and resolve symlinks.
# On macOS, it's not installed by default.
if command -v realpath >/dev/null 2>&1; then
  node_path="$(realpath "$node_path")"
fi

if [ -z "$node_path" ]; then
  # If node_path is not set, define a default path
  node_path="$(command -v node)"
fi

# Some tools like asdf seem to have a node_path but not a command -v node.
# Let's try to find it using which.
if [ -z "$node_path" ]; then
  node_path="$(which node)"
fi

# If node is not in path, we can try to use the one that ran husky.
# npm, pnpm and yarn set this env variable.
if [ -z "$node_path" ]; then
  node_path="$npm_execpath"
fi

# If it's a yarn path, we need to use yarn node.
# Otherwise, we can use node directly.
if [ -n "$YARN_PROJECT_ROOT" ]; then
  node_command="yarn node"
elif [ -n "$node_path" ]; then
  node_command="$node_path"
else
  node_command="node"
fi

# If HUSKY_SKIP_HOOKS is not set or is set to 0, run the hook
if [ "${HUSKY_SKIP_HOOKS:-0}" -eq 0 ]; then
  "$node_command" "node_modules/husky/run.js"
fi
