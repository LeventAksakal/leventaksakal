// Every fact on the site lives here. Sources: the CV (C:\Code\cv) and the owner's answers of
// 16 Nov 2026. Do not add a claim that is in neither.

export const site = {
  name: 'Levent Aksakal',
  url: 'https://leventaksakal.com',
  description:
    'Software engineer in Istanbul and MSc student in computer engineering at Boğaziçi University. Industry work, research, writing, and a shelf of films, games and music.',
  email: 'leventaksakal56@gmail.com',
  github: { handle: 'LeventAksakal', href: 'https://github.com/LeventAksakal' },
  linkedin: { handle: 'levent-aksakal', href: 'https://www.linkedin.com/in/levent-aksakal-85b450236' },
  away: 'Away from the keyboard: playing the guitar, climbing, mountaineering and cooking.',
};

// The page takes its ground and accent colour from the photograph on screen.
export const photos = [
  { id: 'kalekoy', place: 'Kaleköy', when: 'June 2024', alt: 'The harbour village of Kaleköy: wooden boats on deep blue water under a hillside of red roofs', bg: '#0a121c', accent: '#7db6f2', focus: '62% 50%' },
  { id: 'kekova', place: 'Kekova', when: 'June 2024', alt: 'Clear turquoise water over a sunken stone ruin at Kekova', bg: '#071518', accent: '#5fd0d8', focus: '40% 50%' },
  { id: 'cay', place: 'Köprülü Kanyon', when: 'June 2024', alt: 'The clear river at Köprülü Kanyon running over pale rock, with pines on the far bank', bg: '#0c140c', accent: '#9ccf7f', focus: '50% 50%' },
  { id: 'mihrapli', place: 'Mihraplı', when: 'September 2025', alt: 'A white steel arch bridge over a river, a town and wooded hills behind it under heavy cloud', bg: '#101317', accent: '#b9c7d6', focus: '72% 50%' },
  { id: 'ozu', place: 'Özyeğin University', when: 'November 2024', alt: 'A cobbled campus path lined with red autumn trees at Özyeğin University', bg: '#170d0b', accent: '#f08a6c', focus: '45% 50%' },
  { id: 'denizli', place: 'Pamukkale ancient city', when: 'June 2024', alt: 'Trees reflected in a pool covered with yellow-green water plants in the ancient city at Pamukkale', bg: '#15120a', accent: '#e6c84f', focus: '50% 50%' },
] as const;

export type Card =
  | { kind: 'logo'; src: string; alt: string; ground: string; fit?: 'wide' | 'tall' | 'seal' }
  | { kind: 'word'; text: string }
  | { kind: 'repo'; repo: string };

export interface Entry {
  id: string;
  name: string;
  meta: string[];
  text: string;
  href?: string;
  link?: string;
  note?: string;
  card: Card;
}

export const industry: Entry[] = [
  {
    id: 'aps',
    name: 'APS',
    meta: ['Product owner and sole engineer', 'Özyeğin University', '2026 to now'],
    text: 'The university’s academic planning and timetabling system. It replaced forms, spreadsheets and email with approval workflows. I do all of it: talking to the people who use it, product decisions, design, development and testing. NestJS and PostgreSQL, React, a CP-SAT timetabling engine on a Postgres job queue, Kubernetes.',
    note: 'Internal system, not public.',
    card: { kind: 'logo', src: '/logos/aps.svg', alt: 'APS', ground: '#ffffff' },
  },
  {
    id: 'temizel',
    name: 'Temizel İSG',
    meta: ['Product owner and sole engineer', '2026 to now'],
    text: 'E-commerce platform for safety products: storefront, admin panel and API on Cloudflare Workers with Supabase. Payments, shipping, e-invoicing, a WhatsApp ordering bot and an MCP checkout so LLM agents can place orders. I do all of it, from talking to the people who run the shop to design, development and testing.',
    href: 'https://temizelisg.com',
    link: 'temizelisg.com',
    card: { kind: 'logo', src: '/logos/temizel.webp', alt: 'Temizel', ground: '#ffffff' },
  },
  {
    id: 'babytell',
    name: 'BabyTell',
    meta: ['Partner', 'In development'],
    text: 'Bedtime stories told in a parent’s own voice. A friend’s idea that I joined as a partner. Vue 3 on the web, Kotlin and Compose on Android over a shared Rust engine.',
    card: { kind: 'logo', src: '/logos/babytell.svg', alt: 'BabyTell', ground: '#f6efe5', fit: 'tall' },
  },
  {
    id: 'constructor',
    name: 'Constructor Tech',
    meta: ['Software engineering intern', '2025'],
    text: 'Added Redis to the WebSocket server of a video-conferencing product and reworked it for failover, load balancing and migration.',
    href: 'https://constructor.tech',
    link: 'constructor.tech',
    card: { kind: 'logo', src: '/logos/constructor-mark.svg', alt: 'Constructor', ground: '#ffffff' },
  },
  {
    id: 'sage',
    name: 'TÜBİTAK SAGE',
    meta: ['Intern', '2024'],
    text: 'Mobile test automation with Appium; analysis of Android kernel Ethernet and USB-C drivers.',
    href: 'https://www.sage.tubitak.gov.tr',
    link: 'sage.tubitak.gov.tr',
    card: { kind: 'logo', src: '/logos/tubitak-sage.webp', alt: 'TÜBİTAK SAGE', ground: '#ffffff', fit: 'tall' },
  },
];

export const research: Entry[] = [
  {
    id: 'me2exp',
    name: 'Turkish meaning-to-expression search',
    meta: ['MSc research', 'Boğaziçi University', '2026 to now'],
    text: 'Given a meaning, find the Turkish idiom or proverb that says it. A TabiBERT retriever with a calibrated verifier that can abstain, compared against LLM baselines.',
    note: 'Ongoing. Working towards a paper.',
    card: { kind: 'word', text: 'me2exp' },
  },
  {
    id: 'moqtail',
    name: 'MOQtail',
    meta: ['Contributor', 'Open source', '2025'],
    text: 'Media over QUIC Transport libraries. In 2025 I designed and wrote the first version of moqtail-ts, the TypeScript library that follows the IETF draft, including FETCH and a playout buffer. I am no longer a maintainer.',
    href: 'https://moqtail.dev',
    link: 'moqtail.dev',
    card: { kind: 'logo', src: '/logos/moqtail.svg', alt: 'MOQtail', ground: '#ffffff', fit: 'tall' },
  },
];

export const education: Entry[] = [
  {
    id: 'bogazici',
    name: 'Boğaziçi University',
    meta: ['MSc, Computer Engineering', '2026 to 2028'],
    text: 'Thesis track. The direction I want to take, not started yet: backdoors and sleeper agents in language models, and mechanistic interpretability.',
    href: 'https://bogazici.edu.tr',
    link: 'bogazici.edu.tr',
    card: { kind: 'logo', src: '/logos/bogazici.webp', alt: 'Boğaziçi University', ground: '#0b3f86', fit: 'seal' },
  },
  {
    id: 'ozyegin',
    name: 'Özyeğin University',
    meta: ['BSc, Computer Science and Engineering', '2021 to 2025'],
    text: 'GPA 3.73 of 4.00, on a full performance scholarship.',
    href: 'https://www.ozyegin.edu.tr',
    link: 'ozyegin.edu.tr',
    card: { kind: 'logo', src: '/logos/ozyegin.svg', alt: 'Özyeğin University', ground: '#ffffff', fit: 'wide' },
  },
];

export const also: Entry[] = [
  {
    id: 'clearance',
    name: 'Clearance',
    meta: ['Claude Code mod', '2026'],
    text: 'Makes every Claude Code session on a machine aware of its memory and of the other sessions. It shows how many more sessions and subagents fit, holds a new session over the cap and refuses a subagent spawn with a forecast. What a session costs is learned from what this machine was seen to use. Windows only.',
    href: 'https://github.com/LeventAksakal/clearance',
    link: 'GitHub',
    card: { kind: 'repo', repo: 'clearance' },
  },
  {
    id: 'talk-tracks',
    name: 'Talk Tracks',
    meta: ['2026'],
    text: 'AI agents that publish caption and translation tracks into a live talk over Media over QUIC.',
    href: 'https://github.com/LeventAksakal/talk-tracks',
    link: 'GitHub',
    card: { kind: 'logo', src: '/logos/talk-tracks.svg', alt: 'Talk Tracks', ground: '#111113', fit: 'wide' },
  },
  {
    id: 'webtransport-stall',
    name: 'WebTransport stall on Android Chrome',
    meta: ['2026'],
    text: 'A minimal reproduction with evidence: some unidirectional streams never send their FIN.',
    href: 'https://github.com/LeventAksakal/android-chrome-webtransport-stall-repro',
    link: 'GitHub',
    card: { kind: 'repo', repo: 'android-chrome-webtransport-stall-repro' },
  },
  {
    id: 'notification-system',
    name: 'Notification system',
    meta: ['Go', '2026'],
    text: 'Accepts SMS, email and push over HTTP, queues them in MySQL and delivers at up to 100 per second per channel, with priorities, retries, a circuit breaker, scheduling and live status over WebSocket.',
    href: 'https://github.com/LeventAksakal/notification-system',
    link: 'GitHub',
    card: { kind: 'repo', repo: 'notification-system' },
  },
  {
    id: 'quinn-amc',
    name: 'Congestion control on Quinn',
    meta: ['Course project', '2026'],
    text: 'A media-aware augment to QUIC congestion control, with a benchmark harness.',
    href: 'https://github.com/LeventAksakal/quinn-amc',
    link: 'GitHub',
    card: { kind: 'repo', repo: 'quinn-amc' },
  },
  {
    id: 'time-analytics',
    name: 'Time Analytics',
    meta: ['VS Code extension', '2025'],
    text: 'Tracks coding time, idle time and project statistics locally inside VS Code.',
    href: 'https://github.com/LeventAksakal/vscode-time-analytics',
    link: 'GitHub',
    card: { kind: 'logo', src: '/logos/time-analytics.png', alt: 'Time Analytics', ground: '#eef2f4', fit: 'tall' },
  },
];
