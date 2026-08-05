# HackerAI on VPS — ops notes

See **`../VPS_ORGANIZATION.md`** for Fast/Deep paths and RAM gate.

## Quick start

```bash
sudo bash setup-hackerai-service.sh
sudo nano /etc/cyberalert/hackerai.env    # set hsb_ token
sudo bash setup-hackerai-service.sh --enable
```

Then on [hackerai.co](https://hackerai.co): Agent Mode → Remote control → **cyberalert-vps**.

## Rules

- No `--dangerous`
- No Docker sandbox until VPS ≥ 4 GiB (`HACKERAI_ALLOW_DOCKER_SANDBOX=0`)
- Does not modify Cyber Alert request handling by itself
