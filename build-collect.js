#!/usr/bin/env node
/* ============================================
   build-collect.js — 项目收集脚本
   从各独立仓库拉取构建产物到 portfolio/projects/
   ============================================ */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==================== 配置 ====================
const ROOT = __dirname;
const PROJECTS_DIR = path.join(ROOT, 'projects');
const TEMP_DIR = path.join(ROOT, '.collect-temp');
const CONFIG_PATH = path.join(ROOT, 'projects.json');

// ==================== 工具函数 ====================
function log(msg) { console.log(`  \x1b[36m→\x1b[0m ${msg}`); }
function ok(msg)  { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m⚠\x1b[0m ${msg}`); }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', cwd: opts.cwd || ROOT, ...opts });
  } catch (err) {
    if (!opts.ignoreError) throw err;
    return null;
  }
}

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 递归复制目录 */
function copyDir(src, dest) {
  mkdir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ==================== 收集来源类型处理 ====================

/**
 * 本地目录 — 直接复制
 * source: { type: "local", path: "../my-project/dist" }
 */
async function collectFromLocal(project) {
  const srcPath = path.resolve(ROOT, project.source.path);
  const destPath = path.join(PROJECTS_DIR, project.id);

  if (!fs.existsSync(srcPath)) {
    fail(`${project.name}: 源路径不存在 — ${srcPath}`);
    return false;
  }

  // 源与目标相同（source.path 指向 projects/ 内时）→ 跳过复制，避免 rimraf 清空自身
  if (path.resolve(srcPath) === path.resolve(destPath)) {
    log(`${project.name}: 源与目标相同（projects/ 内维护），跳过复制`);
    return true;
  }

  // 如果目标已存在且内容相同则跳过
  log(`${project.name}: 从本地复制 — ${project.source.path}`);
  rimraf(destPath);
  copyDir(srcPath, destPath);
  ok(`${project.name}: 复制完成 → projects/${project.id}/`);
  return true;
}

/**
 * Git 仓库 — clone → build → 复制产物
 * source: {
 *   type: "git",
 *   repo: "https://github.com/user/project.git",
 *   branch: "main",
 *   buildCommand: "npm run build",
 *   buildOutput: "dist"
 * }
 */
async function collectFromGit(project) {
  const src = project.source;
  const repoDir = path.join(TEMP_DIR, project.id);
  const destPath = path.join(PROJECTS_DIR, project.id);

  // 拉取/更新仓库
  if (fs.existsSync(repoDir)) {
    log(`${project.name}: 更新仓库...`);
    run(`git fetch origin`, { cwd: repoDir });
    run(`git checkout ${src.branch || 'main'}`, { cwd: repoDir });
    run(`git pull origin ${src.branch || 'main'}`, { cwd: repoDir });
  } else {
    log(`${project.name}: 克隆仓库 ${src.repo}...`);
    mkdir(TEMP_DIR);
    const branch = src.branch || 'main';
    run(`git clone --depth 1 --branch ${branch} ${src.repo} "${repoDir}"`, { cwd: TEMP_DIR });
  }

  // 安装依赖
  if (fs.existsSync(path.join(repoDir, 'package.json'))) {
    log(`${project.name}: 安装依赖...`);
    run('npm install', { cwd: repoDir });
  }

  // 执行构建
  if (src.buildCommand) {
    log(`${project.name}: 执行构建 — ${src.buildCommand}`);
    run(src.buildCommand, { cwd: repoDir });
  }

  // 复制构建产物
  const outputDir = src.buildOutput || 'dist';
  const srcBuild = path.join(repoDir, outputDir);

  if (!fs.existsSync(srcBuild)) {
    // 如果没有构建产物目录，尝试复制整个仓库（适用于纯静态项目）
    warn(`${project.name}: 构建产物目录 "${outputDir}" 不存在，将复制整个仓库`);
    rimraf(destPath);
    copyDir(repoDir, destPath);
    // 清理不需要的文件
    const toRemove = ['node_modules', '.git', 'package-lock.json', 'yarn.lock', '.gitignore'];
    toRemove.forEach((f) => {
      const fp = path.join(destPath, f);
      if (fs.existsSync(fp)) rimraf(fp);
    });
  } else {
    rimraf(destPath);
    copyDir(srcBuild, destPath);
  }

  ok(`${project.name}: 构建完成 → projects/${project.id}/`);
  return true;
}

// ==================== 主流程 ====================
async function main() {
  console.log('\n📦 作品集项目收集器\n');
  console.log(`  配置: ${CONFIG_PATH}`);
  console.log(`  输出: ${PROJECTS_DIR}\n`);

  // 读取配置
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ 找不到 projects.json 配置文件');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const projects = config.projects || [];

  if (projects.length === 0) {
    console.log('  没有需要收集的项目。');
    return;
  }

  console.log(`  共 ${projects.length} 个项目\n`);

  // 确保输出目录存在
  mkdir(PROJECTS_DIR);

  // 逐个收集
  let success = 0;
  let failed = 0;

  for (const project of projects) {
    console.log(`\n━━━ ${project.name} (${project.id}) ━━━`);

    try {
      const sourceType = project.source?.type || 'local';
      let result;

      switch (sourceType) {
        case 'git':
          result = await collectFromGit(project);
          break;
        case 'local':
        default:
          result = await collectFromLocal(project);
          break;
      }

      if (result) success++;
      else failed++;
    } catch (err) {
      fail(`${project.name}: ${err.message}`);
      failed++;
    }
  }

  // 清理临时目录
  rimraf(TEMP_DIR);

  // 总结
  console.log('\n' + '━'.repeat(40));
  console.log(`\n  ✅ 成功: ${success}  |  ❌ 失败: ${failed}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ 收集过程出错:', err.message);
  rimraf(TEMP_DIR);
  process.exit(1);
});
