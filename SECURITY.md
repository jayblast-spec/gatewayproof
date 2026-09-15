# Security Policy

## Supported versions

This project is at v0.1.x. There is one supported line: the latest published version on npm. Fixes land as a new patch/minor release, not backports.

## Reporting a vulnerability

Please **do not open a public issue** for a security report. Use GitHub's private vulnerability reporting instead:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.

This opens a private advisory visible only to you and the maintainer, so the report and any discussion stay off the public issue tracker until a fix is ready.

You should get an initial response within a few days. If a report turns out to be a real vulnerability, I'll credit you in the advisory (unless you'd rather stay anonymous) once a fix is published.

## Dependency policy

Runtime dependencies are kept minimal deliberately. Where a dependency was considered and rejected specifically for a security reason, that's called out in the README rather than silently avoided -- see the README's own design-tradeoffs section if one exists for this package.
