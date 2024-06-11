#!/bin/bash

# Get the full path of the current directory
CURRENT_DIR=$(pwd)
INPUT=$1
SRC_PATH="$CURRENT_DIR/src/$INPUT.js"
DEST_LINK="/usr/local/bin/$INPUT"

# Check if the script is already installed in $DEST_LINK
if [ -L "$DEST_LINK" ]; then
  # If the script is already installed, remove the symlink and export PATH
  sudo rm "$DEST_LINK" && (export PATH=$PATH:/usr/local/bin)
  echo "uninstalled $INPUT"
else
  # Create a symbolic link to the source file and export PATH
  sudo ln -s "$SRC_PATH" "$DEST_LINK" && (export PATH=$PATH:/usr/local/bin)
  echo "installed $INPUT."
fi