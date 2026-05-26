# Windows Code Signing

Windows client releases must be signed with a trusted code-signing certificate.
Unsigned installers can trigger Microsoft Defender SmartScreen warnings because
Windows cannot verify the publisher or build reputation for the app.

## Required GitHub Secrets

Add these repository Actions secrets before creating a signed release:

```text
CSC_LINK
CSC_KEY_PASSWORD
```

`CSC_LINK` should be the certificate file contents as base64 or a secure URL
that GitHub Actions can access. `CSC_KEY_PASSWORD` is the password for that
certificate.

Do not use a self-signed certificate for client releases. It may sign the file
technically, but it will not establish trusted publisher identity for normal
Windows users.

## Release Flow

1. Buy an OV or EV Windows code-signing certificate from a trusted certificate
   authority.
2. Add `CSC_LINK` and `CSC_KEY_PASSWORD` to GitHub repository secrets.
3. Bump `package.json` version.
4. Commit and push the version change.
5. Create and push a release tag, for example `v1.0.1`.

The release workflow warns if signing secrets are missing. Unsigned builds are
allowed for known clients, but Windows may show Microsoft Defender SmartScreen.
