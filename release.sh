#!/usr/bin/env bash -e
# Inspired by https://github.com/baconjs/bacon.js/blob/master/release

if [ -z $1 ]; then
  echo "usage: release <version>"
  exit 1
fi

version=$1
echo "Releasing with version $version"

echo "Pulling from origin"
git pull --ff-only --no-rebase origin

echo "Building"
npm install
NODE_ENV=production npm run bundle

echo "Updating files"
sed -i "" 's/\("version".*:.*\)".*"/\1"'$version'"/' "package.json"

echo "Commit and tag"
git add .
git commit -m "release $version"
git tag $version

echo "Push to origin/master"
git push
git push --tags origin

echo "Publish to npm"
npm publish

echo "DONE!"