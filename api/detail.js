export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug/Path diperlukan' });
  }

  // Sanitasi slug dari URL penuh atau prefix
  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/anime\//, '')
    .replace(/^\/episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  const slugVariants = [
    cleanSlug,
    `${cleanSlug}-sub-indo`,
    cleanSlug.replace(/-sub-indo$/, '')
  ];

  // Helper fetch dengan timeout ketat 3.5 detik agar Vercel tidak menggantung
  const fetchWithTimeout = async (url, options = {}, timeout = 3500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      return null;
    }
  };

  let fetchedData = null;

  // Coba ambil via Consumet Scraper API
  for (const variant of slugVariants) {
    const apiUrl = `https://api.consumet.org/anime/anichin/info/${variant}`;
    const response = await fetchWithTimeout(apiUrl, {}, 3500);

    if (response && response.ok) {
      try {
        const json = await response.json();
        if (json && json.title) {
          fetchedData = {
            title: json.title,
            poster: json.image || '',
            synopsis: json.description || 'Tidak ada deskripsi.',
            episodes: (json.episodes || []).map(ep => ({
              title: ep.title || `Episode ${ep.number}`,
              slug: ep.id || ep.slug
            }))
          };
          break;
        }
      } catch (e) {}
    }
  }

  // Fallback ke Secondary JSON API jika Consumet sibuk
  if (!fetchedData) {
    for (const variant of slugVariants) {
      const altApiUrl = `https://anichin-api.vercel.app/api/detail/${variant}`;
      const responseAlt = await fetchWithTimeout(altApiUrl, {}, 3500);

      if (responseAlt && responseAlt.ok) {
        try {
          const jsonAlt = await responseAlt.json();
          if (jsonAlt && jsonAlt.title) {
            fetchedData = {
              title: jsonAlt.title,
              poster: jsonAlt.poster || jsonAlt.image || '',
              synopsis: jsonAlt.synopsis || jsonAlt.description || 'Tidak ada deskripsi.',
              episodes: (jsonAlt.episodes || []).map(ep => ({
                title: ep.title || ep.name || 'Episode',
                slug: ep.slug || ep.id
              }))
            };
            break;
          }
        } catch (e) {}
      }
    }
  }

  // Jika semua serverless scraper mengalami timeout/terblokir, kembalikan pesan ganti secara graceful
  if (!fetchedData) {
    return res.status(200).json({ 
      success: false, 
      message: 'Server Anichin sedang mengalami hambatan koneksi/terblokir. Silakan coba beberapa saat lagi.' 
    });
  }

  return res.status(200).json({
    success: true,
    data: fetchedData
  });
}
