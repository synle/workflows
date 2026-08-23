#!/usr/bin/env bash

FILE_TO_WATCH=${1:-"*.json *.scss *.jsx *.js"}
INITIAL_COMMAND_TO_RUN=${2:-"npm run start"}
MAX_FILE_SIZE_KB=${3:-200}

echo """
# dev.sh #####################################################################
curl -fsSL "https://github.com/synle/workflows/blob/main/dev.sh?raw=1" | bash
curl -fsSL "https://github.com/synle/workflows/blob/main/dev.sh?raw=1" | bash -s -- '*.json *.scss *.jsx *.js' 'npm run start' '100'
==============================================================================
FILE_TO_WATCH:          $FILE_TO_WATCH
INITIAL_COMMAND_TO_RUN: $INITIAL_COMMAND_TO_RUN
MAX_FILE_SIZE_KB:       ${MAX_FILE_SIZE_KB}kb
##############################################################################
"""

IGNORED_PATHS=(
	".cache"
	".git"
	".next"
	".venv"
	"build"
	"dist"
	"node_modules"
	"target"
	"venv"
)

if stat -c "%Y %n" /dev/null >/dev/null 2>&1; then
	STAT_CMD="stat -c %Y_%n"
else
	STAT_CMD="stat -f %m_%N"
fi

function get_file_state() {
	FIND_NAME_ARGS=""
	for pattern in $FILE_TO_WATCH; do
		[ -n "$FIND_NAME_ARGS" ] && FIND_NAME_ARGS="$FIND_NAME_ARGS -o"
		FIND_NAME_ARGS="$FIND_NAME_ARGS -name $pattern"
	done

	FIND_IGNORE_ARGS=""
	SEEN_PATHS=""
	for dir in "${IGNORED_PATHS[@]}"; do
		dir=$(echo "$dir" | xargs)
		[ -z "$dir" ] && continue
		echo "$SEEN_PATHS" | grep -qx "$dir" && continue
		SEEN_PATHS="$SEEN_PATHS
$dir"
		FIND_IGNORE_ARGS="$FIND_IGNORE_ARGS -not -path */${dir}/*"
	done

	find . $FIND_IGNORE_ARGS \
		-type f -size -${MAX_FILE_SIZE_KB}k \( $FIND_NAME_ARGS \) \
		-exec $STAT_CMD {} \; 2>/dev/null | sort
}

echo '>> npm install' && npm i >/dev/null 2>&1
echo '>> build.sh' && bash build.sh >/dev/null 2>&1

eval "$INITIAL_COMMAND_TO_RUN" &
APP_PID=$!

trap "kill $APP_PID 2>/dev/null" EXIT

LAST_STATE=$(get_file_state)

while sleep 3; do
	CURRENT_STATE=$(get_file_state)

	if [ "$CURRENT_STATE" != "$LAST_STATE" ]; then
		echo "$(date '+%H:%M:%S') Change detected! Running build.sh..."
		echo '>> build.sh' && bash build.sh >/dev/null 2>&1
		LAST_STATE="$CURRENT_STATE"
	fi
done
