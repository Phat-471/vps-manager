import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import {
  Rocket, Globe, Mail, Database, Key, AlertTriangle, Info,
  CheckCircle, Copy, Terminal, Loader, Server, Layers, StopCircle,
  Search, X, ChevronDown, ChevronRight, Star, Zap, Shield,
  Package, ArrowLeft, Tag
} from 'lucide-react';

// ─── SERVICE CATALOG ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',       label: 'Tất cả',        icon: '⚡' },
  { id: 'cms',       label: 'CMS & Blog',     icon: '📝' },
  { id: 'lang',      label: 'Ngôn ngữ',       icon: '💻' },
  { id: 'db',        label: 'Database',       icon: '🗄️' },
  { id: 'devops',    label: 'DevOps',         icon: '🐳' },
  { id: 'monitor',   label: 'Giám sát',       icon: '📊' },
  { id: 'storage',   label: 'Lưu trữ',       icon: '☁️' },
  { id: 'automation',label: 'Tự động hóa',   icon: '🔄' },
  { id: 'security',  label: 'Bảo mật',       icon: '🔒' },
  { id: 'runtime',   label: 'Runtime',        icon: '🚀' },
];

const SERVICES = [
  // CMS & Blog
  {
    id: 'wordpress', category: 'cms', name: 'WordPress', icon: 'fab fa-wordpress', iconColor: '#21759b',
    desc: 'CMS phổ biến nhất thế giới, dùng cho blog, website thương mại, portfolio.',
    tags: ['CMS', 'PHP', 'MySQL'], stable: '6.5',
    versions: [
      { v: 'latest', label: 'Latest (6.5)', stable: true, note: 'Phiên bản mới nhất, khuyên dùng' },
      { v: '6.4',    label: 'WordPress 6.4', note: 'LTS - Ổn định cao' },
      { v: '6.3',    label: 'WordPress 6.3', note: 'Ổn định' },
      { v: '6.2',    label: 'WordPress 6.2', note: 'Cũ hơn' },
      { v: '6.1',    label: 'WordPress 6.1', note: 'Hỗ trợ hạn chế' },
    ],
    hasPhpVersion: true, hasDomain: true, hasDb: true, hasSSL: true, hasEmail: true,
    formType: 'wordpress',
  },
  {
    id: 'laravel', category: 'cms', name: 'Laravel', icon: 'fab fa-laravel', iconColor: '#ff2d20',
    desc: 'PHP Framework hiện đại, phổ biến cho API backend, web app doanh nghiệp.',
    tags: ['PHP', 'Framework', 'API'], stable: '11.x',
    versions: [
      { v: '11', label: 'Laravel 11.x', stable: true, note: 'Phiên bản mới nhất 2024, khuyên dùng' },
      { v: '10', label: 'Laravel 10.x', note: 'LTS - Hỗ trợ đến 2026' },
      { v: '9',  label: 'Laravel 9.x',  note: 'Ổn định, PHP 8.0+' },
      { v: '8',  label: 'Laravel 8.x',  note: 'Cũ hơn' },
      { v: '7',  label: 'Laravel 7.x',  note: 'EOL - Không khuyên dùng' },
    ],
    hasPhpVersion: true, hasDomain: true, hasDb: true, hasSSL: true, hasEmail: true,
    formType: 'laravel',
  },
  {
    id: 'ghost', category: 'cms', name: 'Ghost', icon: 'fas fa-ghost', iconColor: '#f7a800',
    desc: 'Nền tảng blog/newsletter chuyên nghiệp, tốc độ cao, tích hợp membership.',
    tags: ['Blog', 'Node.js', 'Newsletter'], stable: '5.x',
    defaultPort: '2368',
    versions: [
      { v: 'latest', label: 'Ghost 5.x (Latest)', stable: true, note: 'Phiên bản mới nhất, khuyên dùng' },
      { v: '5.80',   label: 'Ghost 5.80', note: 'Stable' },
      { v: '5.70',   label: 'Ghost 5.70', note: 'Ổn định' },
      { v: '4.48',   label: 'Ghost 4.48 (LTS)', note: 'Hỗ trợ dài hạn' },
      { v: '3.42',   label: 'Ghost 3.42', note: 'Cũ hơn' },
    ],
    hasDomain: true, hasSSL: true, hasPort: true, hasEmail: true,
    formType: 'simple',
  },

  // Ngôn ngữ
  {
    id: 'php', category: 'lang', name: 'PHP', icon: 'fab fa-php', iconColor: '#777bb4',
    desc: 'Cài đặt PHP cùng các extension phổ biến (fpm, gd, mbstring, curl, zip).',
    tags: ['PHP', 'Runtime', 'Backend'], stable: '8.3',
    versions: [
      { v: '8.3', label: 'PHP 8.3', stable: true, note: 'Mới nhất 2024, hiệu năng cao nhất' },
      { v: '8.2', label: 'PHP 8.2', note: 'Rất ổn định, khuyên dùng cho production' },
      { v: '8.1', label: 'PHP 8.1', note: 'LTS, được hỗ trợ đến 11/2025' },
      { v: '8.0', label: 'PHP 8.0', note: 'EOL 11/2023' },
      { v: '7.4', label: 'PHP 7.4', note: 'EOL - Chỉ dùng khi bắt buộc' },
    ],
    hasPhpOnly: true,
    formType: 'php-only',
  },
  {
    id: 'nodejs', category: 'lang', name: 'Node.js', icon: 'fab fa-node-js', iconColor: '#68a063',
    desc: 'Cài đặt Node.js + NPM. Lựa chọn LTS được khuyên dùng cho production.',
    tags: ['Node.js', 'Runtime', 'JavaScript'], stable: '20.x LTS',
    versions: [
      { v: '20', label: 'Node.js 20 (LTS)', stable: true, note: 'Active LTS đến 2026, khuyên dùng' },
      { v: '22', label: 'Node.js 22 (Current)', note: 'Phiên bản hiện tại, mới nhất' },
      { v: '18', label: 'Node.js 18 (LTS)',  note: 'Maintenance LTS đến 2025' },
      { v: '16', label: 'Node.js 16', note: 'EOL - Không khuyên dùng' },
      { v: '14', label: 'Node.js 14', note: 'EOL - Chỉ dùng khi bắt buộc' },
    ],
    formType: 'runtime-only',
  },
  {
    id: 'python', category: 'lang', name: 'Python 3', icon: 'fab fa-python', iconColor: '#3776ab',
    desc: 'Cài đặt Python 3 + pip. Hỗ trợ virtualenv, Django, FastAPI.',
    tags: ['Python', 'Runtime', 'AI/ML'], stable: '3.12',
    versions: [
      { v: '3.12', label: 'Python 3.12', stable: true, note: 'Mới nhất, cải thiện hiệu năng lớn' },
      { v: '3.11', label: 'Python 3.11', note: 'Ổn định cao, khuyên dùng cho production' },
      { v: '3.10', label: 'Python 3.10', note: 'Phổ biến, tương thích tốt' },
      { v: '3.9',  label: 'Python 3.9',  note: 'Ổn định, hỗ trợ đến 2025' },
      { v: '3.8',  label: 'Python 3.8',  note: 'EOL 10/2024' },
    ],
    formType: 'runtime-only',
  },

  // Database
  {
    id: 'phpmyadmin', category: 'db', name: 'phpMyAdmin', icon: 'fas fa-database', iconColor: '#4f5b93',
    desc: 'Giao diện web quản trị MySQL/MariaDB trực quan, cài đặt độc lập qua Nginx.',
    tags: ['MySQL', 'Admin', 'Web UI'], stable: '5.2.1',
    versions: [
      { v: '5.2.1', label: 'phpMyAdmin 5.2.1', stable: true, note: 'Mới nhất, khuyên dùng' },
      { v: '5.2.0', label: 'phpMyAdmin 5.2.0', note: 'Ổn định' },
      { v: '5.1.4', label: 'phpMyAdmin 5.1.4', note: 'Hỗ trợ PHP 7.2+' },
      { v: '4.9.11',label: 'phpMyAdmin 4.9.11',note: 'Cho hệ thống cũ' },
      { v: '4.8.5', label: 'phpMyAdmin 4.8.5', note: 'Legacy' },
    ],
    formType: 'phpmyadmin',
  },
  {
    id: 'mysql', category: 'db', name: 'MySQL / MariaDB', icon: 'fas fa-database', iconColor: '#00758f',
    desc: 'Cài đặt MySQL Server hoặc MariaDB với cấu hình bảo mật tự động.',
    tags: ['Database', 'SQL', 'MySQL'], stable: 'MySQL 8.0',
    versions: [
      { v: 'mysql-8.0',   label: 'MySQL 8.0 (LTS)',   stable: true, note: 'Mới nhất, hiệu năng cao' },
      { v: 'mysql-5.7',   label: 'MySQL 5.7',          note: 'EOL - Chỉ khi bắt buộc' },
      { v: 'mariadb-11',  label: 'MariaDB 11.x',       note: 'Mới nhất, fork của MySQL' },
      { v: 'mariadb-10.11',label:'MariaDB 10.11 (LTS)',note: 'LTS đến 2028' },
      { v: 'mariadb-10.6',label: 'MariaDB 10.6',       note: 'LTS phổ biến' },
    ],
    formType: 'runtime-only',
  },
  {
    id: 'redis', category: 'db', name: 'Redis', icon: 'fas fa-memory', iconColor: '#dc382c',
    desc: 'Cache in-memory tốc độ cao. Dùng cho session, queue, cache Laravel/WordPress.',
    tags: ['Cache', 'Redis', 'NoSQL'], stable: '7.2',
    versions: [
      { v: '7.2', label: 'Redis 7.2', stable: true, note: 'Mới nhất 2024' },
      { v: '7.0', label: 'Redis 7.0', note: 'Ổn định cao' },
      { v: '6.2', label: 'Redis 6.2', note: 'LTS' },
      { v: '6.0', label: 'Redis 6.0', note: 'Cũ hơn' },
      { v: '5.0', label: 'Redis 5.0', note: 'Legacy' },
    ],
    formType: 'runtime-only',
  },

  // DevOps
  {
    id: 'portainer', category: 'devops', name: 'Portainer CE', icon: 'fab fa-docker', iconColor: '#0db7ed',
    desc: 'GUI quản lý Docker container, stack, volume và network trực quan.',
    tags: ['Docker', 'Container', 'DevOps'], stable: '2.x',
    versions: [
      { v: 'latest',  label: 'Portainer CE Latest', stable: true, note: 'Tự động cập nhật phiên bản mới' },
      { v: '2.20',    label: 'Portainer CE 2.20',   note: 'Ổn định nhất hiện tại' },
      { v: '2.19',    label: 'Portainer CE 2.19',   note: 'Ổn định' },
      { v: '2.18',    label: 'Portainer CE 2.18',   note: 'Cũ hơn' },
      { v: '2.17',    label: 'Portainer CE 2.17',   note: 'Legacy' },
    ],
    formType: 'portainer',
  },
  {
    id: 'docker', category: 'devops', name: 'Docker Engine', icon: 'fab fa-docker', iconColor: '#2496ed',
    desc: 'Cài đặt Docker Engine + Docker Compose trên Ubuntu/Debian.',
    tags: ['Docker', 'Container', 'DevOps'], stable: '25.x',
    versions: [
      { v: 'latest', label: 'Docker CE (Latest)', stable: true, note: 'Khuyên dùng - tự cập nhật' },
      { v: '25.0',   label: 'Docker 25.0',         note: 'Ổn định' },
      { v: '24.0',   label: 'Docker 24.0',          note: 'Cũ hơn' },
      { v: '23.0',   label: 'Docker 23.0',          note: 'Legacy' },
      { v: '20.10',  label: 'Docker 20.10',         note: 'EOL - Chỉ khi bắt buộc' },
    ],
    formType: 'runtime-only',
  },
  {
    id: 'nodeapp', category: 'devops', name: 'Node.js Git App', icon: 'fab fa-git-alt', iconColor: '#f05033',
    desc: 'Clone repo từ Git và deploy tự động bằng PM2, hỗ trợ reverse proxy Nginx.',
    tags: ['Node.js', 'Git', 'PM2', 'Deploy'], stable: 'Latest',
    versions: [
      { v: 'pm2-latest', label: 'PM2 (Latest)', stable: true, note: 'Khuyên dùng - quản lý process Node.js' },
      { v: 'pm2-5',      label: 'PM2 v5.x',    note: 'Phiên bản ổn định' },
      { v: 'pm2-4',      label: 'PM2 v4.x',    note: 'Cũ hơn' },
      { v: 'forever',    label: 'Forever',      note: 'Lựa chọn thay thế' },
      { v: 'systemd',    label: 'Systemd Service', note: 'Không cần PM2' },
    ],
    formType: 'nodeapp',
  },

  // Monitoring
  {
    id: 'uptime-kuma', category: 'monitor', name: 'Uptime Kuma', icon: 'fas fa-heartbeat', iconColor: '#5cdd8b',
    desc: 'Công cụ monitoring uptime self-hosted đẹp, hỗ trợ alert Telegram/Slack.',
    tags: ['Monitor', 'Uptime', 'Alert'], stable: '1.x',
    defaultPort: '3001',
    versions: [
      { v: 'latest', label: 'Uptime Kuma Latest', stable: true, note: 'Khuyên dùng' },
      { v: '1.23',   label: 'Uptime Kuma 1.23',   note: 'Ổn định' },
      { v: '1.22',   label: 'Uptime Kuma 1.22',   note: 'Cũ hơn' },
      { v: '1.21',   label: 'Uptime Kuma 1.21',   note: 'Legacy' },
      { v: '1.20',   label: 'Uptime Kuma 1.20',   note: 'Legacy' },
    ],
    hasDomain: true, hasSSL: true, hasPort: true, hasEmail: true,
    formType: 'simple',
  },
  {
    id: 'grafana', category: 'monitor', name: 'Grafana', icon: 'fas fa-chart-line', iconColor: '#f46800',
    desc: 'Dashboard monitoring & visualization mạnh mẽ. Tích hợp Prometheus, InfluxDB.',
    tags: ['Monitoring', 'Dashboard', 'Grafana'], stable: '10.x',
    defaultPort: '3000',
    versions: [
      { v: 'latest', label: 'Grafana OSS (Latest)', stable: true, note: 'Phiên bản mới nhất' },
      { v: '10.2',   label: 'Grafana 10.2',         note: 'Ổn định' },
      { v: '10.1',   label: 'Grafana 10.1',         note: 'Ổn định' },
      { v: '9.5',    label: 'Grafana 9.5 (LTS)',    note: 'LTS' },
      { v: '8.5',    label: 'Grafana 8.5',          note: 'Cũ hơn' },
    ],
    hasPort: true, hasDomain: true, hasSSL: true,
    formType: 'simple',
  },

  // Storage
  {
    id: 'nextcloud', category: 'storage', name: 'Nextcloud', icon: 'fas fa-cloud', iconColor: '#0082c9',
    desc: 'Lưu trữ đám mây cá nhân. Thay thế Google Drive, Dropbox tự host.',
    tags: ['Cloud', 'Storage', 'Collaboration'], stable: '28.x',
    defaultPort: '8080',
    versions: [
      { v: 'latest', label: 'Nextcloud 28 (Latest)', stable: true, note: 'Mới nhất 2024' },
      { v: '27',     label: 'Nextcloud 27',           note: 'Ổn định cao' },
      { v: '26',     label: 'Nextcloud 26',           note: 'Ổn định' },
      { v: '25',     label: 'Nextcloud 25',           note: 'Cũ hơn' },
      { v: '24',     label: 'Nextcloud 24',           note: 'Legacy' },
    ],
    hasDomain: true, hasSSL: true, hasPort: true, hasEmail: true,
    formType: 'simple',
  },
  {
    id: 'minio', category: 'storage', name: 'MinIO', icon: 'fas fa-server', iconColor: '#c72e49',
    desc: 'Object storage tương thích S3 API, tốc độ cao, tự host.',
    tags: ['S3', 'Object Storage', 'MinIO'], stable: 'Latest',
    defaultPort: '9000',
    versions: [
      { v: 'latest', label: 'MinIO (Latest)', stable: true, note: 'Cập nhật liên tục' },
      { v: 'RELEASE.2024-01', label: 'MinIO Jan 2024', note: 'Ổn định' },
      { v: 'RELEASE.2023-12', label: 'MinIO Dec 2023', note: 'Cũ hơn' },
      { v: 'RELEASE.2023-11', label: 'MinIO Nov 2023', note: 'Legacy' },
      { v: 'RELEASE.2023-06', label: 'MinIO Jun 2023', note: 'Legacy' },
    ],
    hasPort: true, hasDomain: true,
    formType: 'simple',
  },

  // Automation
  {
    id: 'n8n', category: 'automation', name: 'n8n', icon: 'fas fa-project-diagram', iconColor: '#ff6d5a',
    desc: 'Nền tảng tự động hóa quy trình workflow mã nguồn mở, tích hợp 400+ dịch vụ.',
    tags: ['Automation', 'Workflow', 'No-code'], stable: '1.x',
    defaultPort: '5678',
    versions: [
      { v: 'latest', label: 'n8n (Latest)', stable: true, note: 'Phiên bản mới nhất' },
      { v: '1.30',   label: 'n8n 1.30',     note: 'Ổn định' },
      { v: '1.20',   label: 'n8n 1.20',     note: 'Ổn định' },
      { v: '1.10',   label: 'n8n 1.10',     note: 'Cũ hơn' },
      { v: '0.236',  label: 'n8n 0.236',    note: 'Legacy' },
    ],
    hasDomain: true, hasSSL: true, hasPort: true, hasEmail: true,
    formType: 'simple',
  },
  {
    id: 'coolify', category: 'automation', name: 'Coolify', icon: 'fas fa-magic', iconColor: '#6d28d9',
    desc: 'PaaS self-host tương tự Heroku/Netlify. Deploy app từ Git hoàn toàn tự động.',
    tags: ['PaaS', 'Deploy', 'Self-host'], stable: '4.x',
    versions: [
      { v: 'latest', label: 'Coolify v4 (Latest)', stable: true, note: 'Phiên bản mới nhất' },
      { v: '4.0',    label: 'Coolify v4.0',        note: 'Stable' },
      { v: '3.12',   label: 'Coolify v3.12',       note: 'Phiên bản cũ' },
      { v: '3.11',   label: 'Coolify v3.11',       note: 'Legacy' },
      { v: '3.10',   label: 'Coolify v3.10',       note: 'Legacy' },
    ],
    formType: 'runtime-only',
  },

  // Security
  {
    id: 'fail2ban', category: 'security', name: 'Fail2ban', icon: 'fas fa-shield-alt', iconColor: '#dc2626',
    desc: 'Tự động chặn IP thực hiện brute-force SSH và web server. Bảo vệ server.',
    tags: ['Security', 'SSH', 'Brute-force'], stable: '1.0.x',
    versions: [
      { v: 'latest', label: 'Fail2ban (Latest)', stable: true, note: 'Từ apt repository chính thức' },
      { v: '1.0.2',  label: 'Fail2ban 1.0.2',   note: 'Ổn định' },
      { v: '0.11.2', label: 'Fail2ban 0.11.2',  note: 'Phiên bản cũ phổ biến' },
      { v: '0.10',   label: 'Fail2ban 0.10',    note: 'Legacy' },
      { v: '0.9',    label: 'Fail2ban 0.9',     note: 'Rất cũ' },
    ],
    formType: 'runtime-only',
  },
  {
    id: 'certbot', category: 'security', name: 'Certbot (SSL)', icon: 'fas fa-lock', iconColor: '#16a34a',
    desc: 'Cài đặt Let\'s Encrypt SSL tự động cho domain. Hỗ trợ auto-renew.',
    tags: ['SSL', 'HTTPS', 'Let\'s Encrypt'], stable: '2.x',
    versions: [
      { v: 'latest', label: "Certbot (Latest Snap)", stable: true, note: 'Khuyên dùng - tự động cập nhật' },
      { v: 'apt',    label: 'Certbot qua APT',       note: 'Từ repository Ubuntu/Debian' },
      { v: 'pip',    label: 'Certbot qua pip',       note: 'Cho môi trường Python' },
      { v: '2.7',    label: 'Certbot 2.7',           note: 'Phiên bản cụ thể' },
      { v: '2.6',    label: 'Certbot 2.6',           note: 'Cũ hơn' },
    ],
    hasDomain: true, hasEmail: true,
    formType: 'certbot',
  },

  // Runtime
  {
    id: 'pm2', category: 'runtime', name: 'PM2', icon: 'fas fa-cogs', iconColor: '#2b69b5',
    desc: 'Process manager cho Node.js. Tự khởi động lại khi crash, quản lý cluster.',
    tags: ['Node.js', 'PM2', 'Process'], stable: '5.x',
    versions: [
      { v: 'latest', label: 'PM2 (Latest)', stable: true, note: 'Cài qua npm global' },
      { v: '5.3',    label: 'PM2 v5.3',    note: 'Ổn định nhất hiện tại' },
      { v: '5.2',    label: 'PM2 v5.2',    note: 'Ổn định' },
      { v: '5.1',    label: 'PM2 v5.1',    note: 'Cũ hơn' },
      { v: '4.5',    label: 'PM2 v4.5',    note: 'Legacy' },
    ],
    formType: 'runtime-only',
  },
  {
    id: 'nginx', category: 'runtime', name: 'Nginx', icon: 'fas fa-server', iconColor: '#009639',
    desc: 'Web server / Reverse Proxy hiệu năng cao. Tiêu chuẩn cho production.',
    tags: ['Web Server', 'Reverse Proxy', 'Nginx'], stable: '1.24',
    versions: [
      { v: 'stable', label: 'Nginx Stable (1.24)', stable: true, note: 'Khuyên dùng cho production' },
      { v: 'mainline',label:'Nginx Mainline (1.25)',note: 'Tính năng mới nhất' },
      { v: '1.22',   label: 'Nginx 1.22 (LTS)',   note: 'LTS' },
      { v: '1.20',   label: 'Nginx 1.20',          note: 'Cũ hơn' },
      { v: '1.18',   label: 'Nginx 1.18',          note: 'Legacy' },
    ],
    formType: 'runtime-only',
  },
];

// Version Badge Component
function VersionBadge({ version, selected, onClick, disabled }) {
  const isStable = version.stable;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(version.v)}
      style={{
        display: 'flex', flexDirection: 'column', padding: '10px 14px',
        border: selected
          ? '1.5px solid rgba(99,102,241,0.7)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left', transition: 'all 0.2s',
        position: 'relative', minWidth: 0,
        boxShadow: selected ? '0 0 12px rgba(99,102,241,0.2)' : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
          e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        }
      }}
    >
      {isStable && (
        <span style={{
          position: 'absolute', top: -8, right: 8,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', fontSize: 9, fontWeight: 700,
          padding: '1px 6px', borderRadius: 20,
          letterSpacing: '0.05em',
        }}>⭐ KHUYÊN DÙNG</span>
      )}
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: selected ? '#a5b4fc' : '#e2e8f0',
        marginBottom: 3,
      }}>{version.label}</span>
      <span style={{ fontSize: 10, color: '#64748b' }}>{version.note}</span>
      {selected && (
        <CheckCircle size={12} style={{
          position: 'absolute', top: 8, right: 8,
          color: '#6366f1'
        }} />
      )}
    </button>
  );
}

// Service Card Component
function ServiceCard({ service, onSelect }) {
  return (
    <div
      onClick={() => onSelect(service)}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '16px', cursor: 'pointer',
        transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${service.iconColor}18`,
          border: `1px solid ${service.iconColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className={service.icon} style={{ color: service.iconColor, fontSize: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{service.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)'
            }}>v{service.stable}</span>
          </div>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4, margin: 0 }}>{service.desc}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {service.tags.map(tag => (
          <span key={tag} style={{
            fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
            background: 'rgba(255,255,255,0.05)', color: '#475569',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>{tag}</span>
        ))}
      </div>
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
        color: '#6366f1', fontWeight: 600,
      }}>
        Cài đặt <ChevronRight size={12} />
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AppInstaller() {
  const { apiCall, showToast, isConnected, socket, currentVPS } = useVPS();

  // View states: 'catalog' | 'configure'
  const [view, setView] = useState('catalog');
  const [selectedService, setSelectedService] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Form states
  const [selectedVersion, setSelectedVersion] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [appName, setAppName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [port, setPort] = useState('3000');
  const [phpVersion, setPhpVersion] = useState('8.2');
  const [ssl, setSsl] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Site');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState(() => Math.random().toString(36).substring(2, 14));
  const [dbMode, setDbMode] = useState('auto');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPass, setDbPass] = useState('');
  const [pmaPort, setPmaPort] = useState(() => String(Math.floor(Math.random() * (9999 - 8000 + 1)) + 8000));
  const [pmaUser, setPmaUser] = useState('pma_admin');
  const [pmaPassword, setPmaPassword] = useState(() => Math.random().toString(36).substring(2, 12));

  // Install states
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [installedData, setInstalledData] = useState(null);
  const [logs, setLogs] = useState('');
  const [pmaStatus, setPmaStatus] = useState({ installed: false, enabled: false, port: '8888' });
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [showPmaForm, setShowPmaForm] = useState(false);

  const logEndRef = useRef(null);
  const preparedDataRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
  }, [logs]);

  // Filter services
  const filteredServices = useMemo(() => {
    let list = SERVICES;
    if (activeCategory !== 'all') list = list.filter(s => s.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const fetchPmaStatus = async () => {
    if (!currentVPS) return;
    setFetchingStatus(true);
    try {
      const res = await apiCall('/api/installer/phpmyadmin/toggle', 'POST', { vpsConfig: currentVPS, action: 'status' });
      if (res.success) setPmaStatus({ installed: res.installed, enabled: res.enabled, port: res.port || '8888' });
    } catch {}
    finally { setFetchingStatus(false); }
  };

  const handleTogglePma = async (action) => {
    setLoading(true);
    try {
      const res = await apiCall('/api/installer/phpmyadmin/toggle', 'POST', { vpsConfig: currentVPS, action });
      if (res.success) { showToast(res.message, 'success'); fetchPmaStatus(); }
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedService?.id === 'phpmyadmin' && isConnected && currentVPS) fetchPmaStatus();
  }, [selectedService, isConnected, currentVPS]);

  // Socket events
  useEffect(() => {
    if (!socket) return;
    const handleOutput = data => setLogs(p => p + data);
    const handleEnded = ({ code, error }) => {
      setLoading(false); setRunning(false);
      if (code === 0) {
        setInstallFailed(false);
        setLogs(p => p + `\n>> [${new Date().toLocaleTimeString()}] ✅ THÀNH CÔNG: Cài đặt hoàn tất!\n`);
        setInstalledData(preparedDataRef.current);
        showToast('Cài đặt thành công!', 'success');
        if (selectedService?.id === 'phpmyadmin') { fetchPmaStatus(); setShowPmaForm(false); }
      } else {
        setInstallFailed(true);
        setLogs(p => p + `\n>> [${new Date().toLocaleTimeString()}] ❌ THẤT BẠI: ${error || `Mã lỗi: ${code}`}\n`);
        showToast('Cài đặt thất bại', 'error');
      }
    };
    socket.on('task:output', handleOutput);
    socket.on('task:ended', handleEnded);
    return () => { socket.off('task:output', handleOutput); socket.off('task:ended', handleEnded); };
  }, [socket, selectedService]);

  const handleSelectService = (service) => {
    setSelectedService(service);
    setView('configure');
    setSelectedVersion(service.versions[0].v);
    setPort(service.defaultPort || '3000');
    setInstallFailed(false); setInstalledData(null); setLogs('');
    setDomain(''); setEmail(''); setAppName(''); setGitUrl('');
    setSsl(false); setAdminUser('admin');
    setAdminPass(Math.random().toString(36).substring(2, 14));
    setDbMode('auto'); setDbName(''); setDbUser(''); setDbPass('');
    setPmaPort(String(Math.floor(Math.random() * (9999 - 8000 + 1)) + 8000));
    setPmaUser('pma_admin');
    setPmaPassword(Math.random().toString(36).substring(2, 12));
    setShowPmaForm(false);
  };

  const handleBack = () => {
    if (running && !window.confirm('Tiến trình đang chạy. Bạn có muốn rời đi không?')) return;
    setView('catalog');
    setSelectedService(null);
  };

  const handleInstall = async (e) => {
    e.preventDefault();
    if (!isConnected) { showToast('WebSocket chưa kết nối. Kết nối VPS trước.', 'error'); return; }
    setLoading(true); setRunning(true); setInstallFailed(false); setInstalledData(null);
    setLogs(`>> [${new Date().toLocaleTimeString()}] Đang chuẩn bị cài đặt ${selectedService.name} v${selectedVersion}...\n`);
    try {
      const activeTab = selectedService.id;
      const payload = { appId: activeTab, version: selectedVersion };
      if (['wordpress','laravel'].includes(activeTab)) {
        payload.domain = domain.trim(); payload.email = email.trim();
        payload.siteTitle = siteTitle.trim(); payload.adminUser = adminUser.trim();
        payload.adminPass = adminPass.trim(); payload.phpVersion = phpVersion; payload.ssl = ssl;
        if (activeTab === 'wordpress') { payload.siteTitle = siteTitle; }
        if (dbMode === 'custom') { payload.dbName = dbName.trim(); payload.dbUser = dbUser.trim(); payload.dbPass = dbPass.trim(); }
      } else if (activeTab === 'nodeapp') {
        payload.appName = appName.trim(); payload.gitUrl = gitUrl.trim(); payload.port = port.trim();
        if (domain.trim()) { payload.domain = domain.trim(); payload.ssl = ssl; payload.email = email.trim(); }
      } else if (activeTab === 'phpmyadmin') {
        payload.pmaPort = pmaPort.trim(); payload.pmaUser = pmaUser.trim(); payload.pmaPassword = pmaPassword.trim();
      } else if (['uptime-kuma','ghost','nextcloud','n8n','grafana','minio'].includes(activeTab)) {
        payload.port = port.trim();
        if (domain.trim()) { payload.domain = domain.trim(); payload.ssl = ssl; payload.email = email.trim(); }
      }
      const res = await apiCall('/api/installer/prepare', 'POST', payload);
      if (res.success) {
        preparedDataRef.current = res.data;
        setLogs(p => p + `>> Đã sinh cấu hình thành công. Bắt đầu cài đặt...\n\n`);
        socket.emit('task:run', { vpsConfig: currentVPS, command: res.command });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setLogs(p => p + `>> ❌ LỖI: ${msg}\n`);
      showToast('Lỗi: ' + msg, 'error');
      setLoading(false); setRunning(false);
    }
  };

  const handleStopTask = () => {
    if (socket && running) {
      socket.emit('task:stop');
      setLogs(p => p + `\n>> [${new Date().toLocaleTimeString()}] ⏹ Đã dừng tiến trình.\n`);
      setRunning(false); setLoading(false);
      showToast('Đã dừng tiến trình', 'info');
    }
  };

  const handleCopyErrorReport = () => {
    navigator.clipboard.writeText(`=== BÁO CÁO LỖI ===\nDịch vụ: ${selectedService?.name}\nPhiên bản: ${selectedVersion}\nLogs:\n${logs}`);
    showToast('Đã sao chép báo cáo lỗi!', 'success');
  };

  const handleSendOnlineReport = async () => {
    setReporting(true);
    try {
      const res = await apiCall('/api/central-monitor/report-bug', 'POST', {
        vpsIp: currentVPS?.host || 'localhost',
        task: `Cài đặt ${selectedService?.name} v${selectedVersion}`,
        logs, details: `Lỗi cài đặt ${selectedService?.name} v${selectedVersion}`
      });
      if (res.success) showToast('Đã gửi báo cáo thành công!', 'success');
    } catch (err) { handleCopyErrorReport(); }
    finally { setReporting(false); }
  };

  const handleCopy = (text, label) => { navigator.clipboard.writeText(text); showToast(`Đã sao chép ${label}!`, 'success'); };

  // ─── CATALOG VIEW ────────────────────────────────────────────────────────
  if (view === 'catalog') {
    return (
      <div className="content-area">
        <Topbar title="TRÌNH CÀI ĐẶT 1-CLICK" />
        <div style={{ padding: '0 4px' }}>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Rocket size={22} style={{ color: '#6366f1' }} />
              Kho Dịch Vụ & Ứng Dụng
            </h1>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              {SERVICES.length} dịch vụ — tìm kiếm, chọn phiên bản và cài đặt 1-click trực tiếp lên VPS.
            </p>
          </div>

          {/* Search + Filter bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{
              flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12, padding: '0 14px', height: 42,
            }}>
              <Search size={16} style={{ color: '#475569', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Tìm kiếm dịch vụ (PHP, WordPress, Docker...)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <X size={14} style={{ color: '#475569', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all' ? SERVICES.length : SERVICES.filter(s => s.category === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: isActive ? '1.5px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? '#a5b4fc' : '#64748b',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{cat.icon}</span>
                  {cat.label}
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 10,
                    background: isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                    color: isActive ? '#818cf8' : '#475569',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Service Grid */}
          {filteredServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#475569' }}>
              <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Không tìm thấy dịch vụ nào phù hợp</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Thử từ khóa khác hoặc chọn danh mục khác</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {filteredServices.map(service => (
                <ServiceCard key={service.id} service={service} onSelect={handleSelectService} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CONFIGURE VIEW ──────────────────────────────────────────────────────
  const svc = selectedService;
  return (
    <div className="content-area">
      <Topbar title="TRÌNH CÀI ĐẶT 1-CLICK" />

      {/* Back + Service header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={handleBack} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 13,
          cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <ArrowLeft size={14} /> Kho dịch vụ
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${svc.iconColor}18`, border: `1px solid ${svc.iconColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span className={svc.icon} style={{ color: svc.iconColor, fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{svc.name}</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{svc.desc}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Version selector + Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Version Selector */}
          <div className="card-glass" style={{ borderRadius: 14, padding: 20 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: '#94a3b8',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>
              <Tag size={14} /> Chọn phiên bản
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {svc.versions.map(ver => (
                <VersionBadge
                  key={ver.v} version={ver}
                  selected={selectedVersion === ver.v}
                  onClick={v => setSelectedVersion(v)}
                  disabled={running}
                />
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="card-glass" style={{ borderRadius: 14, padding: 20 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: '#94a3b8',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>
              <Layers size={14} /> Cấu hình cài đặt
            </h3>

            {/* phpMyAdmin installed status */}
            {svc.id === 'phpmyadmin' && pmaStatus.installed && !showPmaForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    { label: 'Trạng thái', value: pmaStatus.enabled ? 'Đang mở cổng' : 'Đang khóa', ok: pmaStatus.enabled },
                    { label: 'Cổng', value: pmaStatus.port },
                    { label: 'Basic Auth', value: 'Bắt buộc' },
                  ].map(({ label, value, ok }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ok === true ? '#10b981' : ok === false ? '#ef4444' : '#94a3b8' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleTogglePma(pmaStatus.enabled ? 'disable' : 'enable')} disabled={loading}
                    className={`btn ${pmaStatus.enabled ? 'btn-danger' : 'btn-primary'} w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold rounded-lg`}>
                    {pmaStatus.enabled ? <><StopCircle size={14} /> Khóa truy cập</> : <><Rocket size={14} /> Mở truy cập</>}
                  </button>
                </div>
                <button onClick={() => setShowPmaForm(true)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  Cài đặt lại / Thay đổi cấu hình
                </button>
              </div>
            ) : (
              <form onSubmit={handleInstall} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* PHP version selector (for WordPress/Laravel) */}
                {svc.hasPhpVersion && (
                  <div className="form-group">
                    <label className="text-xs text-gray-400 block mb-1">Phiên bản PHP:</label>
                    <div className="flex items-center input-glass px-3 py-1">
                      <Server size={14} className="text-gray-500 mr-2" />
                      <select value={phpVersion} onChange={e => setPhpVersion(e.target.value)} disabled={running}
                        className="bg-transparent border-none outline-none text-xs text-gray-100 w-full cursor-pointer py-1.5"
                        style={{ background: 'none', border: 'none', color: '#f3f4f6' }}>
                        <option value="8.3">PHP 8.3 (Mới nhất)</option>
                        <option value="8.2">PHP 8.2 ⭐ Khuyên dùng</option>
                        <option value="8.1">PHP 8.1 (LTS)</option>
                        <option value="8.0">PHP 8.0</option>
                        <option value="7.4">PHP 7.4 (Cũ)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Domain */}
                {svc.hasDomain && (
                  <div className="form-group">
                    <label className="text-xs text-gray-400 block mb-1">Tên miền (Domain):</label>
                    <div className="flex items-center input-glass px-3 py-1">
                      <Globe size={14} className="text-gray-500 mr-2" />
                      <input type="text" required placeholder="ví dụ: mysite.com" value={domain}
                        onChange={e => setDomain(e.target.value)} disabled={running}
                        className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                        style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                    </div>
                  </div>
                )}

                {/* Port */}
                {svc.hasPort && (
                  <div className="form-group">
                    <label className="text-xs text-gray-400 block mb-1">Cổng (Port):</label>
                    <div className="flex items-center input-glass px-3 py-1">
                      <Server size={14} className="text-gray-500 mr-2" />
                      <input type="number" placeholder="3000" value={port}
                        onChange={e => setPort(e.target.value)} disabled={running}
                        className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                        style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                    </div>
                  </div>
                )}

                {/* SSL toggle */}
                {svc.hasSSL && (
                  <div className="form-group">
                    <div className="flex items-center justify-between input-glass px-3" style={{ height: '36px' }}>
                      <span className="text-xs text-gray-300">Tự động kích hoạt HTTPS (SSL)</span>
                      <label className="switch-container">
                        <input type="checkbox" checked={ssl} onChange={e => setSsl(e.target.checked)} disabled={running} />
                        <span className="switch-slider" />
                      </label>
                    </div>
                  </div>
                )}

                {/* Email (for SSL) */}
                {svc.hasEmail && ssl && (
                  <div className="form-group">
                    <label className="text-xs text-gray-400 block mb-1">Email đăng ký SSL:</label>
                    <div className="flex items-center input-glass px-3 py-1">
                      <Mail size={14} className="text-gray-500 mr-2" />
                      <input type="email" required placeholder="admin@mysite.com" value={email}
                        onChange={e => setEmail(e.target.value)} disabled={running}
                        className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                        style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                    </div>
                  </div>
                )}

                {/* WordPress extras */}
                {svc.id === 'wordpress' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Email Admin:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Mail size={14} className="text-gray-500 mr-2" />
                        <input type="email" required placeholder="admin@mysite.com" value={email}
                          onChange={e => setEmail(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Tài khoản Admin:</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Layers size={14} className="text-gray-500 mr-2" />
                          <input type="text" required value={adminUser} onChange={e => setAdminUser(e.target.value)} disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                            style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Mật khẩu Admin:</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Key size={14} className="text-gray-500 mr-2" />
                          <input type="text" required value={adminPass} onChange={e => setAdminPass(e.target.value)} disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full font-mono"
                            style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                        </div>
                      </div>
                    </div>
                    {/* Database config */}
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Cấu hình Database:</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['auto', 'custom'].map(m => (
                            <button key={m} type="button" onClick={() => setDbMode(m)} disabled={running}
                              className={`btn btn-xs ${dbMode === m ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '2px 10px', fontSize: 10 }}>
                              {m === 'auto' ? 'Tự động' : 'Tùy chỉnh'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {dbMode === 'auto' ? (
                        <p style={{ fontSize: 11, color: '#475569' }}>Tự động tạo database và user ngẫu nhiên bảo mật.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[['DB Name', dbName, setDbName], ['DB User', dbUser, setDbUser], ['DB Pass', dbPass, setDbPass]].map(([lbl, val, set]) => (
                            <div key={lbl} className="flex items-center input-glass px-3 py-1">
                              <Database size={13} className="text-gray-500 mr-2" />
                              <input type="text" placeholder={lbl} value={val} onChange={e => set(e.target.value)} disabled={running}
                                className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                style={{ background: 'none', border: 'none', padding: '5px 0' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Node.js App extras */}
                {svc.id === 'nodeapp' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tên ứng dụng:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Server size={14} className="text-gray-500 mr-2" />
                        <input type="text" required placeholder="my-node-app" value={appName}
                          onChange={e => setAppName(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Git Repository URL:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Globe size={14} className="text-gray-500 mr-2" />
                        <input type="url" required placeholder="https://github.com/user/repo.git" value={gitUrl}
                          onChange={e => setGitUrl(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Cổng ứng dụng (Port):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Server size={14} className="text-gray-500 mr-2" />
                        <input type="number" value={port} onChange={e => setPort(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                  </>
                )}

                {/* phpMyAdmin form */}
                {svc.id === 'phpmyadmin' && (showPmaForm || !pmaStatus.installed) && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Cổng phpMyAdmin:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Server size={14} className="text-gray-500 mr-2" />
                        <input type="number" value={pmaPort} onChange={e => setPmaPort(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[['Basic Auth User', pmaUser, setPmaUser], ['Basic Auth Password', pmaPassword, setPmaPassword]].map(([lbl, val, set]) => (
                        <div key={lbl} className="form-group">
                          <label className="text-xs text-gray-400 block mb-1">{lbl}:</label>
                          <div className="flex items-center input-glass px-3 py-1">
                            <Key size={13} className="text-gray-500 mr-2" />
                            <input type="text" required value={val} onChange={e => set(e.target.value)} disabled={running}
                              className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                              style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Certbot form */}
                {svc.id === 'certbot' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tên miền cần cấp SSL:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Globe size={14} className="text-gray-500 mr-2" />
                        <input type="text" required placeholder="mysite.com" value={domain}
                          onChange={e => setDomain(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Email đăng ký Let's Encrypt:</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Mail size={14} className="text-gray-500 mr-2" />
                        <input type="email" required placeholder="admin@mysite.com" value={email}
                          onChange={e => setEmail(e.target.value)} disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }} />
                      </div>
                    </div>
                  </>
                )}

                {/* Submit / Stop */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  {running ? (
                    <button type="button" onClick={handleStopTask}
                      className="btn btn-danger w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl">
                      <StopCircle size={16} /> Dừng cài đặt
                    </button>
                  ) : (
                    <button type="submit" disabled={loading}
                      className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl"
                      style={{ fontSize: 14 }}>
                      {loading
                        ? <><Loader size={16} className="animate-spin" /> Đang chuẩn bị...</>
                        : <><Zap size={16} /> Cài đặt {svc.name} v{selectedVersion}</>}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right: Logs + Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Installed result */}
          {installedData && (
            <div className="card-glass p-5 rounded-xl animate-fade-in" style={{ borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CheckCircle size={16} /> Cài đặt thành công!
              </h3>
              {installedData.siteUrl && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Đường dẫn:</span>
                  <a href={installedData.siteUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textDecoration: 'underline' }}>
                    {installedData.siteUrl}
                  </a>
                </div>
              )}
              {installedData.pmaUser && (
                <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                  {[['User', installedData.pmaUser], ['Password', installedData.pmaPassword]].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{lbl}:</span>
                      <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {val} <Copy size={12} style={{ cursor: 'pointer', color: '#475569' }} onClick={() => handleCopy(val, lbl)} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live logs */}
          <div className="card-glass" style={{ borderRadius: 14, padding: 20, flex: 1 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Terminal size={14} /> Log cài đặt thời gian thực
              {running && <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s infinite', marginLeft: 4 }} />}
            </h3>
            <pre ref={logEndRef} style={{
              background: 'rgba(0,0,0,0.6)', color: '#4ade80', padding: 14,
              fontFamily: 'monospace', fontSize: 12, borderRadius: 10,
              overflowY: 'auto', maxHeight: 380, whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.5,
            }}>
              {logs || '>> Sẵn sàng. Chọn phiên bản và nhấn Cài đặt...'}
            </pre>

            {/* Error actions */}
            {installFailed && (
              <div style={{ marginTop: 12, padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                  <AlertTriangle size={15} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', margin: 0 }}>Cài đặt thất bại!</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>Hãy gửi báo cáo để được hỗ trợ.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={handleSendOnlineReport} disabled={reporting}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {reporting ? <Loader size={12} className="animate-spin" /> : <Rocket size={12} />}
                    {reporting ? 'Đang gửi...' : 'Gửi báo cáo'}
                  </button>
                  <button onClick={handleCopyErrorReport}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Copy size={12} /> Sao chép log
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
