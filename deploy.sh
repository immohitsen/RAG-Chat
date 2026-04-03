#!/bin/bash
MSG=${1:-"deploy"}
git add .
git commit -m "$MSG"
git push
