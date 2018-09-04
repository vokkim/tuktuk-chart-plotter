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

echo "Updating files"
sed -i "" 's/\("version".*:.*\)".*"/\1"'$version'"/' package.json
sed -i "" 's/\?v=[0-9]*\.[0-9]*\.[0-9]*/\?v='$version'/' *.html

echo "Commit and tag"
git add .
git commit -m "release $version"
git tag $version

echo "Push to origin/master"
git push
git push --tags origin

echo "Publish to npm"
npm publish

#echo "Publish to S3"
#AWS_PROFILE=plotteri aws s3 cp --recursive public/ s3://plotteri.merikartat.space/public --region=eu-central-1 --acl public-read
#AWS_PROFILE=plotteri aws s3 cp s3-index.html s3://plotteri.merikartat.space/index.html --region=eu-central-1 --acl public-read

echo "DONE!"