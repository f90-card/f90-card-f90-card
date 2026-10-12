module.exports = async function (req, res) {
  try {
    const response = await fetch(
      "https://xzqnrpycjxfbyrfaolud.supabase.co/rest/v1/site_settings?id=eq.1&select=store_name,logo_url,primary_color,config",
      {
        headers: {
          apikey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cW5ycHljanhmYnlyZmFvbHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY3NDIsImV4cCI6MjEwNzMxMjc0Mn0.D3asmxTLRI7ZhKofbhxzP3FIaILepUVX2mYQT-mFrAk",
        },
      },
    );
    if (!response.ok) throw new Error("settings");
    const [s] = await response.json();
    const c = s.config || {};
    const candidate = c.app_icon_url || s.logo_url || "/f90-logo.png";
    const iconPath = /\.(png|jpg|jpeg|webp)(\?|$)/i.test(candidate)
      ? candidate
      : "/assets/icons/icon-512.png";
    const icon = /^(https?:)?\/\//.test(iconPath)
      ? iconPath
      : "/" + iconPath.replace(/^\.?\//, "");
    const defaultIcon = [
      "/f90-logo.png",
      "/assets/icons/icon-512.png",
    ].includes(icon);
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({
      id: "/",
      name: s.store_name,
      short_name: s.store_name,
      lang: "ar",
      dir: "rtl",
      start_url: "/index.html#/",
      scope: "/",
      display: "standalone",
      background_color: "#090b10",
      theme_color: s.primary_color || "#fa2444",
      icons: defaultIcon
        ? [
            {
              src: "/assets/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/assets/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ]
        : [{ src: icon, sizes: "any", purpose: "any" }],
      shortcuts: [
        { name: "محفظتي", url: "/index.html#/wallet" },
        { name: "طلباتي", url: "/index.html#/orders" },
      ],
    });
  } catch {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.status(200).json({
      name: "أف تسعين كارد",
      short_name: "أف تسعين كارد",
      lang: "ar",
      dir: "rtl",
      start_url: "/index.html#/",
      scope: "/",
      display: "standalone",
      icons: [
        {
          src: "/assets/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/assets/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
  }
};
