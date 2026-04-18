interface RunCommandOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
}

export async function runGit(
  cwd: string,
  args: string[],
  options: Omit<RunCommandOptions, "cwd"> = {},
): Promise<string> {
  const result = await runCommand(["git", ...args], {
    cwd,
    env: options.env,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in '${cwd}': ${result.stderr || result.stdout || `exit ${result.exitCode}`}`,
    );
  }

  return result.stdout.trim();
}

export async function runCommand(
  cmd: string[],
  options: RunCommandOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn({
    cmd,
    cwd: options.cwd,
    env: options.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    stdout,
    stderr,
    exitCode,
  };
}

export async function gitHeadCommit(cwd: string): Promise<string> {
  return runGit(cwd, ["rev-parse", "HEAD"]);
}

export async function gitCurrentBranch(cwd: string): Promise<string> {
  return runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function gitStatusPorcelain(cwd: string): Promise<string> {
  return runGit(cwd, ["status", "--porcelain"]);
}

export async function gitHasChanges(cwd: string, baseCommit: string): Promise<boolean> {
  const [status, head] = await Promise.all([
    gitStatusPorcelain(cwd),
    gitHeadCommit(cwd),
  ]);

  return status.length > 0 || head !== baseCommit;
}

export function isProcessAlive(pid: number | null): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
