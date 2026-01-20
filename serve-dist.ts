// Simple server to preview the dist folder
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    
    const file = Bun.file(`./dist${filePath}`);
    return new Response(file);
  },
});

console.log("🚀 Serving dist/ at http://localhost:3000");


