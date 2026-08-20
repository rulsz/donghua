    // Ambil daftar episode persis urutan dari web sumber (terbaru di atas)
    let episodes = [];
    try {
      $('.eplister ul li a, .eplist ul li a').each((_, el) => {
        const epTitle = $(el).find('.epl-title').text().trim() || $(el).find('.epl-num').text().trim() || $(el).text().trim();
        const epHref = $(el).attr('href') || '';
        const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
        
        if (epSlug && !episodes.some(e => e.slug === epSlug)) {
          episodes.push({ title: epTitle, slug: epSlug });
        }
      });
      
      // Jangan disort/dibalik di backend, biarkan sesuai struktur asli web sumber
    } catch (err) {}
