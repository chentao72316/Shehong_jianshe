<template>
  <router-view />
</template>

<style>
/* ── Design Tokens ─────────────────────────────────────────── */
:root {
  /* Palette */
  --color-sidebar-bg:      #0f172a;
  --color-sidebar-hover:   #1e293b;
  --color-sidebar-active:  #1e3a8a;
  --color-sidebar-text:    #94a3b8;
  --color-sidebar-text-active: #ffffff;
  --color-sidebar-border:  #1e293b;
  --color-accent:          #1d4ed8;
  --color-accent-light:    #dbeafe;
  --color-accent-hover:    #1e40af;

  --color-bg:              #f1f5f9;
  --color-surface:         #ffffff;
  --color-border:          #e2e8f0;
  --color-border-light:    #f1f5f9;

  --color-text-primary:    #0f172a;
  --color-text-secondary:  #475569;
  --color-text-muted:      #94a3b8;

  --color-success:         #059669;
  --color-warning:         #d97706;
  --color-danger:          #dc2626;

  /* Spacing & Shape */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --shadow-sm:   0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md:   0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg:   0 10px 30px rgba(0, 0, 0, 0.12);

  /* Typography */
  --font-sans: -apple-system, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Cascadia Code", Consolas, monospace;

  /* Element Plus overrides */
  --el-color-primary:         #1d4ed8;
  --el-color-primary-light-3: #93c5fd;
  --el-color-primary-light-5: #bfdbfe;
  --el-color-primary-light-7: #dbeafe;
  --el-color-primary-light-8: #eff6ff;
  --el-color-primary-light-9: #f8faff;
  --el-color-primary-dark-2:  #1e40af;

  --el-color-success:         #059669;
  --el-color-warning:         #d97706;
  --el-color-danger:          #dc2626;
  --el-color-info:            #64748b;

  --el-border-radius-base:    6px;
  --el-border-radius-small:   4px;
  --el-border-radius-large:   8px;
  --el-border-color:          #e2e8f0;
  --el-border-color-light:    #f1f5f9;
  --el-border-color-lighter:  #f8fafc;

  --el-text-color-primary:    #0f172a;
  --el-text-color-regular:    #334155;
  --el-text-color-secondary:  #64748b;
  --el-text-color-placeholder:#94a3b8;

  --el-bg-color:              #ffffff;
  --el-bg-color-page:         #f1f5f9;
  --el-fill-color-blank:      #ffffff;
  --el-fill-color-light:      #f8fafc;
  --el-fill-color:            #f1f5f9;

  --el-font-family:           var(--font-sans);
  --el-font-size-base:        14px;

  --el-box-shadow-light:      var(--shadow-sm);
  --el-box-shadow:            var(--shadow-md);
}

/* ── Reset ─────────────────────────────────────────────────── */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

/* ── Element Plus Global Tweaks ────────────────────────────── */

/* Cards */
.el-card {
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: var(--shadow-sm) !important;
}

.el-card__header {
  padding: 14px 20px !important;
  border-bottom: 1px solid var(--color-border) !important;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.el-card__body {
  padding: 20px !important;
}

/* Buttons */
.el-button {
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: all 0.15s ease;
}

.el-button--primary:not(.is-link):not(.is-text) {
  background-color: var(--color-accent) !important;
  border-color: var(--color-accent) !important;
}

.el-button--primary:not(.is-link):not(.is-text):hover,
.el-button--primary:not(.is-link):not(.is-text):focus {
  background-color: var(--color-accent-hover) !important;
  border-color: var(--color-accent-hover) !important;
}

/* Inputs */
.el-input__wrapper {
  border-radius: var(--radius-sm) !important;
  box-shadow: 0 0 0 1px var(--color-border) inset !important;
  transition: box-shadow 0.15s ease;
}

.el-input__wrapper:hover {
  box-shadow: 0 0 0 1px #93c5fd inset !important;
}

.el-input__wrapper.is-focus {
  box-shadow: 0 0 0 2px var(--color-accent) inset !important;
}

.el-select .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 2px var(--color-accent) inset !important;
}

/* Table */
.el-table {
  font-size: 13px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.el-table th.el-table__cell {
  background-color: #f8fafc !important;
  color: var(--color-text-secondary) !important;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 0;
}

.el-table td.el-table__cell {
  color: var(--color-text-primary);
  padding: 12px 0;
}

.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell {
  background: #fafbfc !important;
}

.el-table__body tr:hover > td.el-table__cell {
  background-color: #f0f7ff !important;
}

/* Tags */
.el-tag {
  border-radius: var(--radius-sm) !important;
  font-size: 12px;
  font-weight: 500;
  padding: 0 8px;
  height: 22px;
  line-height: 22px;
}

/* Pagination */
.el-pagination {
  font-size: 13px;
}

.el-pager li.is-active {
  background-color: var(--color-accent) !important;
  border-radius: var(--radius-sm) !important;
}

/* Form */
.el-form-item__label {
  font-weight: 500;
  color: var(--color-text-secondary) !important;
  font-size: 13px;
}

/* Dialog */
.el-dialog {
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-lg) !important;
}

.el-dialog__header {
  padding: 20px 24px 16px !important;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0 !important;
}

.el-dialog__title {
  font-weight: 600;
  font-size: 16px;
  color: var(--color-text-primary);
}

.el-dialog__body {
  padding: 20px 24px !important;
}

.el-dialog__footer {
  padding: 16px 24px !important;
  border-top: 1px solid var(--color-border);
}

/* Descriptions */
.el-descriptions__label {
  color: var(--color-text-secondary) !important;
  font-weight: 500;
  font-size: 13px;
  background-color: #f8fafc !important;
}

/* Timeline */
.el-timeline-item__tail {
  border-color: var(--color-border) !important;
}

.el-timeline-item__node {
  background-color: var(--color-accent) !important;
}

/* Dropdown */
.el-dropdown-menu {
  border-radius: var(--radius-md) !important;
  border: 1px solid var(--color-border) !important;
  box-shadow: var(--shadow-md) !important;
  padding: 4px !important;
}

.el-dropdown-menu__item {
  border-radius: var(--radius-sm) !important;
  font-size: 13px;
  padding: 8px 14px !important;
}

/* Radio buttons */
.el-radio-button__inner {
  font-size: 13px !important;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
