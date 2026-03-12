# BCP Monitor — Sistemas Operativos

Herramienta desarrollada en Node.js usando el módulo nativo `os`
para monitorear procesos activos, identificar PIDs y visualizar
cómo la CPU distribuye su carga entre núcleos.

---

## ¿Qué es el BCP?

El **Bloque de Control de Proceso (BCP)** es la estructura que
el sistema operativo mantiene por cada proceso activo. Contiene:

| Campo   | Descripción                              |
|---------|------------------------------------------|
| PID     | Identificador único del proceso          |
| PPID    | PID del proceso padre                    |
| Estado  | Running / Sleeping / Zombie / Stopped    |
| CPU%    | Porcentaje de CPU consumido              |
| MEM%    | Porcentaje de RAM consumida              |
| Usuario | Propietario del proceso                  |

---

## Módulos de Node.js utilizados

| Módulo           | Uso                                         |
|------------------|---------------------------------------------|
| `os.cpus()`      | Información y carga de cada núcleo          |
| `os.totalmem()`  | Memoria RAM total                           |
| `os.freemem()`   | Memoria RAM libre                           |
| `os.uptime()`    | Tiempo activo del sistema                   |
| `os.hostname()`  | Nombre del servidor                         |
| `os.type()`      | Tipo de sistema operativo                   |
| `child_process.exec()`  | Ejecutar comando `ps` del SO        |
| `child_process.spawn()` | Lanzar workers de estrés de CPU     |
| `readline`       | Menú interactivo en terminal                |

---

## Requisitos

- Node.js v16+
- Linux (Ubuntu / Debian / Amazon Linux)
- Sin dependencias externas (solo módulos built-in de Node.js)

---

## Instalación
```bash
git clone https://github.com/TU-USUARIO/bcp-monitor.git
cd bcp-monitor
```

---

## Uso
```bash
node bcp_monitor.js
```

### Opciones del menú

| Opción | Descripción |
|--------|-------------|
| 1 | Dashboard en tiempo real (CPU + procesos) |
| 2 | Listar todos los procesos activos con su BCP |
| 3 | Monitorear un PID específico segundo a segundo |
| 4 | ⚡ Estresar la CPU y ver distribución por núcleo |
| 5 | Ver información del sistema con el módulo os |

### Modos directos
```bash
node bcp_monitor.js --dashboard      # Dashboard directo
node bcp_monitor.js --stress 2       # Estresar 2 núcleos
node bcp_monitor.js --pid 1234 20    # Monitorear PID por 20s
```

---

## Ejemplo de salida
```
🖥️  BCP Monitor — Sistemas Operativos
──────────────────────────────────────────────────
SO:         Linux 5.15.0 (x64)
Hostname:   castserver
Núcleos:    2 núcleos lógicos
RAM Total:  4.0 GB

Distribución de Carga por Núcleo:
  Núcleo 00  ███░░░░░░░░░░░░░░░░░░░░░░  12.4%
  Núcleo 01  ████████████████████████░  98.1%  ← worker de estrés

Top Procesos Activos — BCP:
  PID    PPID   USUARIO     CPU%  MEM%  ESTADO  PROCESO
  3847   3800   ubuntu      98.5   0.4  R       node
  1      0      root         0.0   0.3  Ssl     systemd
  850    1      root         0.0   0.1  S       sshd
```

---

## Estados del BCP

| Estado | Descripción |
|--------|-------------|
| R | Running — el proceso está usando la CPU ahora mismo |
| S | Sleeping — esperando un evento |
| D | DiskWait — esperando operación de disco |
| Z | Zombie — terminó pero el padre no lo recolectó |
| T | Stopped — proceso pausado |

---

## Autor

Asignatura: Sistemas Operativos  
Universidad Cooperativa de Colombia  
Profesor: Andres Camilo Duarte Eraso
