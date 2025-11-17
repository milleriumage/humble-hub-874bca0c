# 🚀 Como Conectar em Salas Reais do IMVU

## ✅ Etapa 1: Iniciar o Backend Local

```bash
cd backend
npm install
npm start
```

O servidor vai iniciar em `http://localhost:3001`

## ✅ Etapa 2: Expor o Backend via Túnel HTTPS

### Opção A: Usando ngrok (Recomendado)

```bash
# Instale o ngrok se não tiver: https://ngrok.com/download
ngrok http 3001
```

Você vai ver algo como:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3001
```

### Opção B: Usando Cloudflare Tunnel

```bash
# Instale: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
cloudflared tunnel --url http://localhost:3001
```

## ✅ Etapa 3: Configurar a URL no App

**Copie a URL do túnel** (ex: `https://abc123.ngrok-free.app`)

No app Lovable aberto no navegador, abra o DevTools (F12) e execute:

```javascript
localStorage.setItem('BACKEND_URL', 'https://abc123.ngrok-free.app');
location.reload();
```

## ✅ Etapa 4: Testar a Conexão

1. **Verifique os System Logs** - Deve aparecer `[WebSocket] Connected to backend server`
2. Vá em **"Bots"** → Adicione um bot ou clique em Login
3. Entre com suas credenciais do IMVU
4. Vá em **"Rooms"** → Buscar salas
5. Entre em uma sala real do IMVU!

## 🔧 Troubleshooting

### WebSocket não conecta?
- Verifique se o backend está rodando (`npm start` na pasta backend)
- Confirme se o túnel está ativo (ngrok/cloudflared)
- Confirme que salvou a URL correta no localStorage
- Recarregue a página após salvar

### Login falha?
- Verifique suas credenciais do IMVU
- Certifique-se de que o backend consegue acessar a API do IMVU
- Verifique os logs do backend no terminal

### Erros TypeScript do SDK?
- **Ignore-os!** Os erros em `imvu.js-master/` não afetam o app
- O backend usa a versão compilada (JavaScript) do SDK
- Esses erros são apenas no SDK de terceiros, não no seu código

## 📝 Notas Importantes

- **Segurança**: Nunca compartilhe sua URL do ngrok publicamente (ela tem acesso direto ao seu backend local)
- **Temporário**: URLs do ngrok free mudam a cada restart
- **Produção**: Para deploy real, considere hospedar o backend em um servidor dedicado (Heroku, Railway, Render, etc.)

## 🎯 Próximos Passos

Depois de conectado:
- Teste entrar em múltiplas salas
- Configure a personalidade da IA nas Settings
- Experimente a feature de bot-to-bot conversation
- Monitore os logs em tempo real no Dashboard
