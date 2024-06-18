#!/bin/bash

# Get the full path of the current directory
CURRENT_DIR=$(pwd)
SRC_DIR="$CURRENT_DIR/src/scripts"
DEST_DIR="/usr/local/bin"

# Function to install a script
install_script() {
  local FILE=$1
  local FILENAME=$(basename "$FILE" .js)
  local DEST_LINK="$DEST_DIR/$FILENAME"

  # Check if the script is already installed in $DEST_LINK
  if [ -L "$DEST_LINK" ]; then
    sudo rm "$DEST_LINK"
  fi

  # Create a symbolic link to the source file and export PATH
  sudo ln -s "$FILE" "$DEST_LINK" && (export PATH=$PATH:/usr/local/bin)
  echo "installed $FILENAME"
}

# Function to uninstall a script
uninstall_script() {
  local FILE=$1
  local FILENAME=$(basename "$FILE" .js)
  local DEST_LINK="$DEST_DIR/$FILENAME"

  # Check if the script is already installed in $DEST_LINK
  if [ -L "$DEST_LINK" ]; then
    sudo rm "$DEST_LINK" && (export PATH=$PATH:/usr/local/bin)
    echo "uninstalled $FILENAME"
  else
    echo "$FILENAME is not installed"
  fi
}

# Check for the -u flag
UNINSTALL=false
if [ "$1" == "-u" ]; then
  UNINSTALL=true
  shift
fi

# Check if a specific script name is provided
if [ -n "$1" ]; then
  SCRIPT_NAME=$1
  SCRIPT_PATH="$SRC_DIR/$SCRIPT_NAME.js"

  if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Script $SCRIPT_PATH does not exist."
    exit 1
  fi

  if $UNINSTALL; then
    uninstall_script "$SCRIPT_PATH"
  else
    install_script "$SCRIPT_PATH"
  fi
else
  # Loop through each file in the SRC_DIR
  for FILE in "$SRC_DIR"/*.js; do
    if $UNINSTALL; then
      uninstall_script "$FILE"
    else
      install_script "$FILE"
    fi
  done
fi