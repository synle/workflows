# $1 default format command to use
# $2 timeout in seconds (default 20)
FORMAT_COMMAND_TO_RUN=${1:-"npm run format"}
FORMAT_TIMEOUT=${2:-20}

# available format steps (whitelist)
AVAILABLE_FORMAT_STEPS=(
	"format_cleanup"
	"format_cleanup_light"
	"format_other_text_based_files"
	"format_python"
	"format_js"
)

# default format steps order (format_js omitted — oxfmt in the closing command already covers JS/TS)
DEFAULT_FORMAT_STEPS=(
	"format_cleanup_light"
	"format_other_text_based_files"
	"format_python"
)

# use passed-in steps (remaining args after $1 and $2) or fall back to defaults
shift 2 2>/dev/null || shift 2>/dev/null || true
if [ $# -gt 0 ]; then
	FORMAT_STEPS=("$@")
else
	FORMAT_STEPS=("${DEFAULT_FORMAT_STEPS[@]}")
fi

echo """
# format.sh ###########################################################################################################
curl -fsSL "https://github.com/synle/workflows/blob/main/format.sh?raw=1" | bash
curl -fsSL "https://github.com/synle/workflows/blob/main/format.sh?raw=1" | bash -s -- "npm run format"
=======================================================================================================================
FORMAT_COMMAND_TO_RUN: $FORMAT_COMMAND_TO_RUN
FORMAT_TIMEOUT: $FORMAT_TIMEOUT
FORMAT_STEPS: ${FORMAT_STEPS[*]}
#######################################################################################################################
"""

# source the format functions from bashrc repo
source <(curl -fsSL "https://github.com/synle/bashrc/blob/main/.build/format.sh?raw=1")

# export the step functions so they are visible to the child shells below
export -f format_js format_python format_cleanup format_cleanup_light format_other_text_based_files 2>/dev/null || true

# run formatting steps
for step in "${FORMAT_STEPS[@]}"; do
	# validate step is in the available list
	is_valid=false
	for available in "${AVAILABLE_FORMAT_STEPS[@]}"; do
		if [ "$step" = "$available" ]; then
			is_valid=true
			break
		fi
	done

	if [ "$is_valid" = false ]; then
		echo ">> Skipping unknown format step: $step"
		continue
	fi

	timeout "$FORMAT_TIMEOUT" "$step" || echo "$step failed or skipped."
done
echo "All formatting steps complete (some may have warnings)."

# run the custom format command (remote timeout takes: seconds, single command string)
echo ">> Running custom format command: $FORMAT_COMMAND_TO_RUN"
timeout "$FORMAT_TIMEOUT" "$FORMAT_COMMAND_TO_RUN" || echo "Custom format command failed."
echo ">> Format completed."
