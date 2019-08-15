# tag-packages

Tag (or branch) monorepo packages for prerelease consumption

This is similar to https://github.com/ramasilveyra/gitpkg, but takes two different approaches.

1. Runs against all your monorepo packages at once.
1. Does not version the tags (or branches), which means they continually get rewritten.

## Usage

Assuming a monorepo with the packages "foo" and "bar", running

```
# in your monorepo root
npx tag-packages
```

would give you the tags "foo" and "bar".

## Options

```
# specify the packages dir
npx tag-packages libs
```

```
# use branches instead of tags
REF_TYPE=branch npx tag-packages
```

```
# cleanup
REMOVE_ONLY=true npx tag-packages
```
