#!/bin/bash
cd "$(dirname "$0")"

node ./report-mac-usage.js --period 4d --verbose

read -p "Press enter to continue"
