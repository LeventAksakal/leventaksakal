export default {
  en: {
    nav: {
      about: 'About',
      work: 'Work',
      gallery: 'Gallery',
      blogs: 'Blogs',
    },
    about: {
      opener: "I'm ",
      paragraphs: [
        'a computer engineering graduate from Özyeğin University, currently based in Bursa, Türkiye. I see myself as a versatile programmer who enjoys the full spectrum of development - from databases and backend servers to web frameworks, ML pipelines, and cloud infrastructure. I love building complete solutions that solve real problems.',
        "My approach to development is driven by curiosity and a desire to understand how things work at every layer. Whether I'm designing system architectures, optimizing database queries, or experimenting with machine learning models, I focus on creating robust, maintainable solutions that can scale with real-world demands.",
        "Beyond coding, I'm passionate about staying active and exploring new experiences. You'll find me playing guitar, experimenting in the kitchen with new recipes and desserts, or training calisthenics. I'm also a gamer and love immersive storytelling through films and games.",
        "I thrive on adventure and outdoor challenges - from mountaineering and rock climbing to skiing, water skiing, hiking, and cycling. Whether it's finding the right line down a mountain or navigating a tricky climbing route, I just love being outdoors and pushing myself physically.",
      ],
    },
    work: {
      subtitle: 'Featured Projects',
      currentFocus: {
        opener: 'I work on ',
        content:
          "system design and fullstack applications using Vue, TypeScript, and Rust for most of my recent work. I've worked with different languages and tools throughout my career and I'm flexible to adapt to whatever technology best fits the project needs.",
      },
      featuredProjects: [
        {
          id: 'moqtail',
          title: 'MOQtail',
          description:
            'Open-source Media-over-QUIC library implementing the latest MoQ draft specification. Major contributor to this TypeScript/Rust project focused on ultra-low latency live streaming.',
          technologies: ['TypeScript', 'Rust', 'QUIC', 'WebCodecs', 'Media Streaming'],
          link: 'https://moqtail.dev',
          repo: 'https://github.com/kixelated/moqtail',
        },
        {
          id: 'kind-cluster-k6',
          title: 'Kind Cluster K6 Testing',
          description:
            'Complete Kubernetes testing environment using Kind clusters with K6 load testing. Includes Prometheus monitoring, Grafana visualization, and automated deployment scripts for stress testing applications.',
          technologies: ['Kubernetes', 'Kind', 'K6', 'Prometheus', 'Grafana', 'Docker'],
          repo: 'https://github.com/LeventAksakal/kind-cluster-k6',
        },
        {
          id: 'personal-website',
          title: 'Personal Website',
          description:
            'Vue 3 portfolio website with internationalization support and responsive design. Features dynamic background rotation, glass morphism UI, and Element Plus components.',
          technologies: ['Vue 3', 'TypeScript', 'Tailwind CSS', 'Element Plus', 'Vue i18n', 'Vite'],
          link: 'https://leventaksakal.dev',
          repo: 'https://github.com/LeventAksakal/leventaksakal',
        },
      ],
      previousPositions: {
        title: 'Previous Positions',
        positions: [
          {
            company: 'Constructor Technology',
            position: 'Software Engineering Intern (Remote)',
            startDate: 'Apr 2024',
            endDate: 'Jul 2024',
            isOngoing: false,
            description:
              'WebSocket server development for web-based video conferencing product with Redis integration',
            website: 'https://constructor.tech/',
            favicon: 'https://constructor.tech/sites/default/files/favicon_1.ico',
          },
          {
            company: 'TÜBİTAK SAGE',
            position: 'Software Engineering Intern (Onsite)',
            startDate: 'Aug 2024',
            endDate: 'Sep 2024',
            isOngoing: false,
            description:
              'Mobile test automation with Appium and Android kernel research for Ethernet to USB-C drivers',
            website: 'https://www.sage.tubitak.gov.tr/',
            favicon: 'https://www.sage.tubitak.gov.tr/favicon.ico',
          },
        ],
      },
    },
    gallery: {
      title: 'Gallery',
      subtitle: 'Moments & Places',
      description:
        "A collection of moments from my journey - places I've visited, activities I enjoy, and experiences that inspire my work and creativity.",
    },
    common: {
      name: 'Zafer Levent Aksakal',
    },
  },
  tr: {
    nav: {
      about: 'Hakkımda',
      work: 'Çalışmalarım',
      gallery: 'Galeri',
      blogs: 'Bloglar',
    },
    about: {
      opener: 'Ben ',
      paragraphs: [
        "Özyeğin Üniversitesi Bilgisayar Mühendisliği mezunuyum ve şu an Bursa'da yaşıyorum. Kendimi çok yönlü bir programcı olarak tanımlıyorum - veritabanlarından backend'e, web framework'lerinden ML pipeline'larına ve bulut sistemlerine kadar her alanda çalışmayı seviyorum. Gerçek problemlere tam çözümler üretmeye odaklanırım.",
        'Geliştirme yaparken merak güdümlü bir yaklaşımım var, her katmanda işlerin nasıl döndüğünü anlama isteği duyarım. Sistem mimarileri tasarlarken, veritabanı sorgularını optimize ederken ya da makine öğrenmesi modelleriyle deneyler yaparken, gerçek dünya ihtiyaçlarına ölçeklenebilen sağlam çözümler üretmeye odaklanırım.',
        'Kodlama dışında aktif kalmaya ve yeni deneyimler keşfetmeye tutkuluyum. Beni gitar çalarken, mutfakta yeni tarifler ve tatlılarla deneyler yaparken ya da kalistenik antrenmanı yaparken bulabilirsiniz. Ayrıca oyun oynayıp film ve oyunların sürükleyici hikayelerini de çok severim.',
        'Macera ve açık hava zorluklarında kendimi buluyorum - dağcılık, kaya tırmanışı, kayak, su kayağı, yürüyüş ve bisiklet. Dağda doğru rotayı bulmak ya da zorlu tırmanış rotalarında ilerlemek, açık havada olmak ve kendimi fiziksel olarak zorlamak hoşuma gidiyor.',
      ],
    },
    work: {
      subtitle: 'Öne Çıkan Projeler',
      currentFocus: {
        opener: 'Yaptığım iş genelde ',
        content:
          'sistem tasarımı ve fullstack uygulamalar - son dönemde çoğunlukla Vue, TypeScript ve Rust kullanıyorum. Geçmişte farklı diller ve araçlarla çalıştım, projenin ihtiyacına göre hangi teknoloji daha uygunsa ona uyum sağlayabilirim.',
      },
      featuredProjects: [
        {
          id: 'moqtail',
          title: 'MOQtail',
          description:
            'En güncel MoQ draft spesifikasyonunu uygulayan açık kaynak Media-over-QUIC kütüphanesi. Ultra-düşük gecikme canlı yayın odaklı bu TypeScript/Rust projesine ana katılımcı olarak katkıda bulundum.',
          technologies: ['TypeScript', 'Rust', 'QUIC', 'WebCodecs', 'Media Streaming'],
          link: 'https://moqtail.dev',
          repo: 'https://github.com/kixelated/moqtail',
        },
        {
          id: 'kind-cluster-k6',
          title: 'Kind Cluster K6 Test Ortamı',
          description:
            'Kind cluster ile K6 yük testi kullanarak eksiksiz Kubernetes test ortamı. Prometheus monitoring, Grafana görselleştirme ve uygulamaları stres testine tabi tutmak için otomatik deployment scriptleri içeriyor.',
          technologies: ['Kubernetes', 'Kind', 'K6', 'Prometheus', 'Grafana', 'Docker'],
          repo: 'https://github.com/LeventAksakal/kind-cluster-k6',
        },
        {
          id: 'personal-website',
          title: 'Kişisel Website',
          description:
            'Çoklu dil desteği ve responsive tasarım içeren Vue 3 portfolio sitesi. Dinamik arkaplan rotasyonu, cam morfizmi UI ve Element Plus bileşenleri kullanılıyor.',
          technologies: ['Vue 3', 'TypeScript', 'Tailwind CSS', 'Element Plus', 'Vue i18n', 'Vite'],
          link: 'https://leventaksakal.dev',
          repo: 'https://github.com/LeventAksakal/leventaksakal',
        },
      ],
      previousPositions: {
        title: 'Önceki Pozisyonlar',
        positions: [
          {
            company: 'Constructor Technology',
            position: 'Yazılım Mühendisliği Stajyeri (Uzaktan)',
            startDate: 'Nis 2024',
            endDate: 'Tem 2024',
            isOngoing: false,
            description:
              'Web tabanlı video konferans ürünü için Redis entegrasyonlu WebSocket server geliştirme',
            website: 'https://constructor.tech/',
            favicon: 'https://constructor.tech/sites/default/files/favicon_1.ico',
          },
          {
            company: 'TÜBİTAK SAGE',
            position: 'Yazılım Mühendisliği Stajyeri (Yerinde)',
            startDate: 'Ağu 2024',
            endDate: 'Eyl 2024',
            isOngoing: false,
            description:
              'Appium ile mobil test otomasyonu ve Ethernet-USB-C sürücüleri için Android kernel araştırması',
            website: 'https://www.sage.tubitak.gov.tr/',
            favicon: 'https://www.sage.tubitak.gov.tr/favicon.ico',
          },
        ],
      },
    },
    gallery: {
      title: 'Galeri',
      subtitle: 'Anılar ve Yerler',
      description:
        'Yolculuğumdan anılar - ziyaret ettiğim yerler, keyif aldığım aktiviteler ve işime ve yaratıcılığıma ilham veren deneyimler.',
    },
    common: {
      name: 'Zafer Levent Aksakal',
    },
  },
}
