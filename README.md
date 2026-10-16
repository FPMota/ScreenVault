# ScreenVault

ScreenVault é o meu diário privado de séries. Nasceu porque uso o Banco de Séries há anos para saber em que episódio vou, mas queria um espaço mais pessoal e visual, inspirado na experiência do Letterboxd: uma biblioteca bonita, avaliações, reviews, listas e um diário do que vejo.

O Letterboxd continua a ser o meu lugar para filmes. O ScreenVault existe para preencher essa mesma necessidade no mundo das séries, sem misturar os dois hábitos.

## Para que serve

Uso o ScreenVault para manter todas as minhas séries num único sítio e acompanhar o meu percurso com cada uma:

- Guardar séries que estou a ver, quero continuar ou já terminei
- Marcar o progresso de episódios
- Dar uma avaliação de 1 a 5 estrelas
- Escrever reviews pessoais
- Consultar um diário e estatísticas da minha biblioteca

A aplicação é pessoal e foi pensada primeiro para iPhone. A versão web funciona como uma PWA: abre no Safari e pode ser adicionada ao ecrã principal como uma app.

## Privacidade

O repositório é público, mas a minha biblioteca não é publicada. A lista, o progresso, as avaliações e as reviews são guardados apenas no armazenamento local do dispositivo.

O ficheiro pessoal `data/imports/series-progress.json` fica fora do Git. Depois de abrir a app, vou a **Perfil → Importar lista privada** e colo o conteúdo completo desse ficheiro.

## Abrir no iPhone

Depois do deploy automático no Vercel, abro o URL no Safari e escolho **Partilhar → Adicionar ao ecrã principal**. A app passa a aparecer no iPhone como um atalho próprio.

Para testar durante o desenvolvimento com Expo Go:

1. Instalar **Expo Go** no iPhone.
2. Ligar o iPhone e o computador à mesma rede Wi-Fi.
3. Executar:

   ```powershell
   cd C:\ScreenVault\mobile
   npm run start -- --lan
   ```

4. Ler o código QR com a Câmara e abrir no Expo Go.

## Deploy

O Vercel usa [vercel.json](vercel.json) para instalar as dependências da pasta `mobile`, gerar a versão web e publicar a pasta `mobile/dist`. Um `git push` para o repositório ligado ao Vercel desencadeia um novo deploy.

## Sincronização privada

O ScreenVault usa Supabase para sincronizar a biblioteca entre dispositivos. Antes do primeiro uso:

1. No Supabase, abrir o **SQL Editor** e executar [supabase/schema.sql](supabase/schema.sql).
2. Em **Authentication → URL Configuration**, adicionar o URL de produção do Vercel à lista de Redirect URLs.
3. No Vercel, criar estas variáveis de ambiente para **Production** e **Preview**:

   ```text
   EXPO_PUBLIC_SUPABASE_URL
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

O ficheiro `mobile/.env` é apenas local e nunca deve ser enviado para o Git. A publishable key é usada pela app; o acesso aos dados continua fechado pelas regras da base de dados, que permitem cada utilizador ler e alterar apenas os seus próprios registos.
