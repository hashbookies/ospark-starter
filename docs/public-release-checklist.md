# Public release checklist

Before uploading this ZIP or creating a public repository:

- [ ] Replace `YOUR-ACCOUNT` in README with the intended public repository URL.
- [ ] Confirm project name, maintainer attribution and MIT copyright holder.
- [ ] Confirm any branding and screenshot usage is authorized.
- [ ] Review NOTICE and attribution when incorporating any upstream code or assets.
- [ ] Run `npm test` and `npm run check` with Node 20+.
- [ ] Confirm `npm start` works on a **clean unpacked copy** without secrets, software services, or a GPU.
- [ ] Confirm all demo screens and output records say `SIMULATED` or `DEMO`.
- [ ] Confirm connected mode shows `UNCONFIGURED` until endpoints are set.
- [ ] Verify `.env`, keys, auth cookies, model files, logs, private user data and real databases are absent.
- [ ] Check for hard-coded home directories, personal names, customer names, internal URLs and task artifacts.
- [ ] Run a recognized secret scanner such as Gitleaks or TruffleHog on the **public candidate directory**.
- [ ] Do not include your private repository `.git` history or Git remotes.
- [ ] Verify optional chat is disabled by default and never points at an agent with tool execution.
- [ ] Explain that this public starter is not the full OSPARK runtime and does not perform real agent actions.

The provided ZIP is intended to be a fresh archive of only public starter files, not a filtered clone of private project history.
