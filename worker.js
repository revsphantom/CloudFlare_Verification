export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/verify') {
      return handleVerification(request, env.SECRET_KEY);
    }

    const isVerified = await checkVerification(request);
    return isVerified ? fetch(request) : serveVerificationPage(env.SITE_KEY, url.pathname);
  }
};

async function checkVerification(request) {
  const cookie = request.headers.get('Cookie');
  return cookie && cookie.includes('verified=gruyère'); /* cheese cookies?? */
}

async function handleVerification(request, secretKey) {
  const { 'cf-turnstile-response': token } = await request.json();
  const ip = request.headers.get('CF-Connecting-IP');

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);

  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
  const { success } = await result.json();

  return new Response(
    JSON.stringify({ success }),
    {
      status: success ? 200 : 401,
      headers: {
        'Content-Type': 'application/json',
        ...(success && { 'Set-Cookie': 'verified=gruyère; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600' })
      }
    }
  );
}

function serveVerificationPage(siteKey, originalPath) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>revsphantom</title>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
      <style>
      * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: black;
    }
    
    header {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 80px;
      background-color: rgba(0, 0, 0, 0.9);
      z-index: 10000;
    }
    
    .spacer {
      height: 100px;
    }
    
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .content {
      text-align: center;
      padding: 20px;
    }
    
    .site-title, h1 {
      font-family: "Press Start 2P";
      color: #ffa500;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      margin-bottom: 20px;
    }
    
    .site-title {
      font-size: 36px;
      text-align: center;
      position: relative;
    }
    
    h1 {
      font-size: 24px;
    }
    
    p {
      font-size: 18px;
      color: #ffffff;
      max-width: 600px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    #accessGranted {
      font-family: "Press Start 2P";
      font-size: 48px;
      color: #F71735;
      position: fixed;
      top: 50%;
      left: 0;
      width: 100%;
      text-align: center;
      opacity: 0;
      transform: translateY(-50%);
      z-index: 10001;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 900px) {
      .site-title, h1 {
        font-size: 22px;
      }
      p {
        font-size: 16px;
      }
      #accessGranted {
        font-size: 36px;
      }
    }
    
    @media (max-width: 600px) {
      #accessGranted {
        font-size: 24px;
      }
    }
      </style>
    </head>
    <body>
      <header></header>
      <div class="spacer"></div>
      <main>
        <h1 class="site-title">revsphantom</h1>
        <div class="content">
          <h1>verification</h1>
          <div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="onVerification"></div>
        </div>
      </main>
      <div id="accessGranted"></div>
      <script>
        const originalPath = "${originalPath}";

        async function onVerification(token) {
          const response = await fetch('/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'cf-turnstile-response': token })
          });
          const data = await response.json();
          if (data.success) {
            showAccessGranted();
          }
        }

        function showAccessGranted() {
          const accessGranted = document.getElementById('accessGranted');
          const text = "access granted";
          let i = 0;
          
          function typeWriter() {
            if (i < text.length) {
              accessGranted.textContent += text.charAt(i);
              i++;
              setTimeout(typeWriter, 100);
            } else {
              setTimeout(() => {
                window.location.href = originalPath;
              }, 1000);
            }
          }

          accessGranted.style.opacity = '1';
          typeWriter();
        }
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}