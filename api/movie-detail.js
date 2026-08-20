export default async function handler(req, res) {
  try {
    let { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug diperlukan' });
    }

    const cleanSlug = String(slug).trim();
    const keyword = cleanSlug.replace(/-/g, ' ').replace(/\b(2025|2026)\b/g, '').trim();

    // Server pemutar video universal yang langsung merender film dengan bersih tanpa iklan landing page
    const servers = [
      {
        name: 'Server Utama HD',
        url: cleanSlug.startsWith('tt') ? `https://vidsrc.xyz/embed/movie?imdb=${cleanSlug}` : `https://vidsrc.xyz/embed/movie?title=${encodeURIComponent(keyword)}`
      },
      {
        name: 'Server Alternatif',
        url: cleanSlug.startsWith('tt') ? `https://vidsrc.cc/v2/embed/movie/${cleanSlug}` : `https://vidsrc.cc/v2/embed/movie?q=${encodeURIComponent(keyword)}`
      }
    ];

    return res.status(200).json({
      success: true,
      data: {
        title: keyword.toUpperCase(),
        poster: '',
        synopsis: 'Nikmati streaming film kualitas HD dengan server tercepat dan bebas gangguan.',
        isMovie: true,
        servers
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail film' });
  }
}
