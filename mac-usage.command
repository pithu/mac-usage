#!/bin/bash
cd "$(dirname "$0")"

node ./report-mac-usage.js

read -p "Press enter to continue"