const os = require('os');
const { exec, spawn } = require('child_process');
const readline = require('readline');

// ── COLORES ──────────────────────────────────────
const C = {
  reset:   '\x1b[0m',  bold:    '\x1b[1m',
  cyan:    '\x1b[36m', green:   '\x1b[32m',
  yellow:  '\x1b[33m', red:     '\x1b[31m',
  blue:    '\x1b[34m', magenta: '\x1b[35m',
  gray:    '\x1b[90m', white:   '\x1b[37m',
  bgBlue:  '\x1b[44m',
};

// ── UTILIDADES ────────────────────────────────────
function limpiar()       { process.stdout.write('\x1bc'); }
function pad(s, n)       { return String(s).padEnd(n); }
function padL(s, n)      { return String(s).padStart(n); }
function linea(c='─',n=78){ return c.repeat(n); }

function formatBytes(b) {
  if (b >= 1073741824) return (b/1073741824).toFixed(1)+' GB';
  if (b >= 1048576)    return (b/1048576).toFixed(1)+' MB';
  return (b/1024).toFixed(1)+' KB';
}

function barra(pct, ancho=25) {
  const lleno = Math.round((pct/100)*ancho);
  const vacio = ancho - lleno;
  let color = C.green;
  if (pct > 60) color = C.yellow;
  if (pct > 85) color = C.red;
  return color+'█'.repeat(lleno)+C.gray+'░'.repeat(vacio)+C.reset;
}

// ── SNAPSHOT CPU ──────────────────────────────────
// os.cpus() devuelve tiempos acumulados por núcleo
// Se necesitan dos snapshots para calcular el % real
function snapshot() {
  return os.cpus().map(c => ({
    idle:  c.times.idle,
    total: Object.values(c.times).reduce((a,b) => a+b, 0),
  }));
}

function calcularUso(prev, curr) {
  return curr.map((c, i) => {
    const dIdle  = c.idle  - prev[i].idle;
    const dTotal = c.total - prev[i].total;
    if (dTotal === 0) return 0;
    return Math.min(100, Math.max(0, (1 - dIdle/dTotal)*100));
  });
}

// ── SECCIÓN 1: INFO DEL SISTEMA ───────────────────
// Usa exclusivamente el módulo os de Node.js
function mostrarSistema() {
  const cpus   = os.cpus();
  const total  = os.totalmem();
  const libre  = os.freemem();
  const usado  = total - libre;
  const pct    = ((usado/total)*100).toFixed(1);
  const up     = os.uptime();
  const h = Math.floor(up/3600);
  const m = Math.floor((up%3600)/60);
  const s = Math.floor(up%60);

  console.log('\n'+C.bgBlue+C.bold+C.white+
    '  🖥️  BCP MONITOR — Sistemas Operativos  '+C.reset);
  console.log(C.gray+linea()+C.reset);

  // os.type()     → nombre del SO  (Linux, Darwin, Windows_NT)
  // os.release()  → versión del kernel
  // os.arch()     → arquitectura   (x64, arm64...)
  // os.hostname() → nombre del host
  // os.uptime()   → segundos activo
  // os.cpus()     → array de núcleos con modelo y tiempos
  // os.totalmem() → RAM total en bytes
  // os.freemem()  → RAM libre en bytes

  console.log(`${C.cyan}SO:        ${C.reset}${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`${C.cyan}Hostname:  ${C.reset}${os.hostname()}`);
  console.log(`${C.cyan}Uptime:    ${C.reset}${h}h ${m}m ${s}s`);
  console.log(`${C.cyan}CPU modelo:${C.reset}${cpus[0].model}`);
  console.log(`${C.cyan}Núcleos:   ${C.reset}${cpus.length} núcleos lógicos`);
  console.log(`${C.cyan}RAM total: ${C.reset}${formatBytes(total)}`);
  console.log(`\n${C.bold}${C.yellow}Uso de Memoria RAM:${C.reset}`);
  console.log(`  ${barra(parseFloat(pct),30)} ${C.bold}${pct}%${C.reset} `+
    `${C.gray}(${formatBytes(usado)} usados / ${formatBytes(total)} total)${C.reset}`);
}

// ── SECCIÓN 2: CARGA POR NÚCLEO ───────────────────
// os.cpus() devuelve para cada núcleo:
//   { model, speed, times: { user, nice, sys, idle, irq } }
function mostrarNucleos(uso) {
  console.log(`\n${C.bold}${C.yellow}Distribución de Carga por Núcleo:${C.reset}`);
  uso.forEach((pct, i) => {
    const pctStr = pct.toFixed(1).padStart(5)+'%';
    console.log(
      `  ${C.blue}Núcleo ${String(i).padStart(2,'0')}${C.reset}  `+
      `${barra(pct,25)} ${C.bold}${pctStr}${C.reset}`
    );
  });
}

// ── SECCIÓN 3: TABLA DE PROCESOS (BCP) ────────────
// El BCP (Bloque de Control de Proceso) contiene:
//   PID    → identificador único del proceso
//   PPID   → PID del proceso padre
//   ESTADO → Running/Sleeping/Zombie/etc
//   CPU%   → porcentaje de CPU que consume
//   MEM%   → porcentaje de RAM que consume
// Se obtiene con child_process.exec() llamando al comando ps del SO
function obtenerProcesos(callback) {
  exec(
    `ps -eo pid,ppid,user,%cpu,%mem,stat,comm --sort=-%cpu | head -21`,
    (err, stdout) => {
      if (err) { callback([]); return; }
      const procs = stdout.trim().split('\n').slice(1).map(l => {
        const p = l.trim().split(/\s+/);
        return {
          pid:    p[0], ppid:  p[1],
          user:   p[2], cpu:   p[3],
          mem:    p[4], stat:  p[5],
          nombre: p.slice(6).join(' '),
        };
      });
      callback(procs);
    }
  );
}

function mostrarProcesos(procs) {
  console.log(`\n${C.bold}${C.yellow}Top Procesos Activos — BCP (Block Control Process):${C.reset}`);
  console.log(C.gray+linea()+C.reset);
  console.log(C.bold+
    `  ${pad('PID',7)}${pad('PPID',7)}${pad('USUARIO',12)}`+
    `${padL('CPU%',6)} ${padL('MEM%',5)}  ${pad('ESTADO',7)}PROCESO`+
    C.reset);
  console.log(C.gray+linea()+C.reset);

  procs.forEach(p => {
    const v = parseFloat(p.cpu);
    let cc = C.green;
    if (v > 30) cc = C.yellow;
    if (v > 70) cc = C.red;

    // Colores según estado del BCP
    let sc = C.gray;
    const st = p.stat || '';
    if (st.startsWith('R')) sc = C.green;    // Running  - en CPU ahora mismo
    if (st.startsWith('S')) sc = C.blue;     // Sleeping - esperando evento
    if (st.startsWith('D')) sc = C.yellow;   // DiskWait - esperando disco
    if (st.startsWith('Z')) sc = C.red;      // Zombie   - terminó sin recolectar
    if (st.startsWith('T')) sc = C.magenta;  // Stopped  - pausado

    console.log(
      `  ${C.cyan}${pad(p.pid,7)}${C.reset}`+
      `${C.gray}${pad(p.ppid,7)}${C.reset}`+
      `${C.white}${pad(p.user,12)}${C.reset}`+
      `${cc}${padL(p.cpu,6)}${C.reset} `+
      `${C.magenta}${padL(p.mem,5)}${C.reset}  `+
      `${sc}${pad(st,7)}${C.reset}`+
      `${C.bold}${p.nombre}${C.reset}`
    );
  });

  console.log(
    C.gray+'\n  Estados BCP: '+C.reset+
    C.green+'R=Running '+C.blue+'S=Sleeping '+
    C.yellow+'D=DiskWait '+C.red+'Z=Zombie '+C.magenta+'T=Stopped'+C.reset
  );
}

// ── SECCIÓN 4: MONITOREAR UN PID ─────────────────
function monitorearPid(pid, duracion=15) {
  console.log(`\n${C.cyan}${C.bold}Monitoreando PID ${pid} por ${duracion} segundos...${C.reset}\n`);
  console.log(C.gray+linea()+C.reset);
  console.log(C.bold+
    `${'Tiempo'.padEnd(8)}${'PID'.padEnd(8)}${'CPU%'.padEnd(8)}`+
    `${'MEM%'.padEnd(8)}${'Estado'.padEnd(9)}Proceso`+C.reset);
  console.log(C.gray+linea()+C.reset);

  let t = 0;
  const timer = setInterval(() => {
    t++;
    exec(
      `ps -p ${pid} -o pid,%cpu,%mem,stat,comm --no-headers`,
      (err, out) => {
        if (err || !out.trim()) {
          console.log(`${C.gray}t+${t}s${C.reset}  ${C.red}Proceso ${pid} terminó${C.reset}`);
          clearInterval(timer);
          return;
        }
        const p = out.trim().split(/\s+/);
        const v = parseFloat(p[1]);
        let cc = C.green;
        if (v > 30) cc = C.yellow;
        if (v > 70) cc = C.red;

        console.log(
          `${C.gray}t+${String(t).padStart(2,'0')}s${C.reset}  `+
          `${C.cyan}${p[0].padEnd(8)}${C.reset}`+
          `${cc}${p[1].padEnd(8)}${C.reset}`+
          `${C.magenta}${p[2].padEnd(8)}${C.reset}`+
          `${C.blue}${(p[3]||'-').padEnd(9)}${C.reset}`+
          `${C.bold}${p[4]}${C.reset}`
        );

        if (t >= duracion) {
          clearInterval(timer);
          console.log(C.gray+linea()+C.reset);
          console.log(`\n${C.green}✅ Monitoreo completado.${C.reset}\n`);
        }
      }
    );
  }, 1000);
}

// ── SECCIÓN 5: ESTRÉS DE CPU ──────────────────────
// Usa spawn() para lanzar procesos hijos que saturan la CPU
// con operaciones matemáticas pesadas durante 30 segundos
let workers = [];

function iniciarEstres(nucleos=1) {
  // Este código se ejecutará en cada worker hijo
  const workerCode = `
    process.title = 'bcp-stress-worker';
    const fin = Date.now() + 30000;
    while (Date.now() < fin) {
      Math.sqrt(Math.random() * 9999999999);
      Math.pow(Math.random(), 3.14159);
    }
    process.exit(0);
  `;

  console.log(`\n${C.red}${C.bold}⚡ Lanzando ${nucleos} worker(s) de estrés...${C.reset}\n`);

  for (let i = 0; i < nucleos; i++) {
    // spawn() lanza un proceso hijo independiente
    const hijo = spawn(process.execPath, ['-e', workerCode], {
      detached: false,
      stdio:    'ignore',
    });
    workers.push(hijo);
    console.log(`  ${C.yellow}Worker ${i+1} lanzado → PID: ${C.bold}${hijo.pid}${C.reset}`);
  }
  return workers.map(w => w.pid);
}

function detenerWorkers() {
  workers.forEach(w => { try { w.kill('SIGTERM'); } catch(e){} });
  workers = [];
  console.log(`\n${C.green}✅ Workers detenidos.${C.reset}\n`);
}

// ── MODO: DASHBOARD EN TIEMPO REAL ───────────────
function dashboard(ms=2000) {
  let prev = snapshot();

  const update = () => {
    const curr = snapshot();
    const uso  = calcularUso(prev, curr);
    prev = curr;
    limpiar();
    mostrarSistema();
    mostrarNucleos(uso);
    obtenerProcesos(procs => {
      mostrarProcesos(procs);
      console.log(`\n${C.gray}  Refrescando cada ${ms/1000}s | Ctrl+C para salir${C.reset}`);
    });
  };

  update();
  const t = setInterval(update, ms);
  process.on('SIGINT', () => {
    clearInterval(t);
    detenerWorkers();
    console.log(`\n${C.yellow}Dashboard cerrado.${C.reset}\n`);
    process.exit(0);
  });
}

// ── MODO: ESTRÉS + MONITOREO AUTOMÁTICO ──────────
function modoEstres(nucleos=1) {
  limpiar();
  const pids      = iniciarEstres(nucleos);
  const pidTarget = pids[0];

  console.log(`\n${C.yellow}Esperando que los workers alcancen carga máxima...${C.reset}`);

  setTimeout(() => {
    let prev = snapshot();
    let t    = 0;
    const max = 25;

    console.log(`\n${C.bold}${C.yellow}Monitoreo en vivo — Carga por núcleo:${C.reset}\n`);
    console.log(C.gray+linea()+C.reset);

    const timer = setInterval(() => {
      const curr = snapshot();
      const uso  = calcularUso(prev, curr);
      prev = curr;
      t++;

      const avg    = (uso.reduce((a,b)=>a+b,0)/uso.length).toFixed(1);
      const nucStr = uso.map((u,i) =>
        `N${i}:${C.bold}${u.toFixed(0).padStart(3)}%${C.reset}`
      ).join('  ');

      process.stdout.write(
        `\r${C.gray}t+${String(t).padStart(2,'0')}s${C.reset}  `+
        `${nucStr}  `+
        `${C.yellow}Avg: ${C.bold}${avg}%${C.reset}  `+
        `PID worker: ${C.cyan}${C.bold}${pidTarget}${C.reset}    `
      );

      if (t >= max) {
        clearInterval(timer);
        detenerWorkers();
        console.log('\n');
        obtenerProcesos(procs => mostrarProcesos(procs));
      }
    }, 1000);
  }, 1500);
}

// ── MENÚ PRINCIPAL ────────────────────────────────
async function menu() {
  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  limpiar();
  console.log('\n'+C.bgBlue+C.bold+C.white+
    '  🖥️  BCP Monitor — Sistemas Operativos  \n'+C.reset);
  console.log(C.gray+linea()+C.reset);
  console.log(`\n  ${C.cyan}1.${C.reset} Dashboard en tiempo real (CPU + procesos)`);
  console.log(`  ${C.cyan}2.${C.reset} Listar procesos activos con su BCP`);
  console.log(`  ${C.cyan}3.${C.reset} Monitorear un PID específico`);
  console.log(`  ${C.cyan}4.${C.reset} ${C.red}⚡ Estresar CPU${C.reset} y ver distribución por núcleo`);
  console.log(`  ${C.cyan}5.${C.reset} Info del sistema (módulo os)\n`);

  const op = await ask(`${C.yellow}  Elige una opción [1-5]: ${C.reset}`);
  rl.close();

  switch (op.trim()) {

    case '1':
      dashboard(2000);
      break;

    case '2':
      limpiar();
      mostrarSistema();
      obtenerProcesos(procs => mostrarProcesos(procs));
      break;

    case '3': {
      const rl2  = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask2 = q => new Promise(r => rl2.question(q, r));
      const ps   = await ask2(`\n  ${C.cyan}PID a monitorear: ${C.reset}`);
      const ds   = await ask2(`  ${C.cyan}Duración en segundos [default 15]: ${C.reset}`);
      rl2.close();
      limpiar();
      monitorearPid(parseInt(ps.trim()), parseInt(ds.trim()) || 15);
      break;
    }

    case '4': {
      const rl3  = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask3 = q => new Promise(r => rl3.question(q, r));
      const ns   = await ask3(
        `\n  ${C.cyan}¿Cuántos núcleos estresar? (tu VM tiene ${os.cpus().length}): ${C.reset}`
      );
      rl3.close();
      modoEstres(Math.min(parseInt(ns.trim()) || 1, os.cpus().length));
      break;
    }

    case '5':
      limpiar();
      mostrarSistema();
      mostrarNucleos(os.cpus().map(() => 0));
      break;

    default:
      console.log(C.red+'Opción inválida.'+C.reset);
  }
}

// ── INICIO ────────────────────────────────────────
const args = process.argv.slice(2);
if      (args[0]==='--dashboard') dashboard();
else if (args[0]==='--stress')    modoEstres(parseInt(args[1])||1);
else if (args[0]==='--pid')       monitorearPid(parseInt(args[1]), parseInt(args[2])||15);
else                              menu();
