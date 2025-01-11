import fs from 'fs/promises';
import { 
    createWriteStream,
    createReadStream,
    existsSync,
    mkdirSync
} from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import unzipper from 'unzipper';
import { exec } from 'child_process';
import util from 'util';
import terraformPaths from './terraform-binary-paths.json';

const TERRAFORM_VERSION = '1.10.4';

const execPromise = util.promisify(exec);

const BINARY_FOLDER = path.join(__dirname, '/terraform-binary');

if (!existsSync(BINARY_FOLDER)) {
  mkdirSync(BINARY_FOLDER);
}

enum system_os_enum {
  macos='macos',
  windows='windows',
  linux='linux',
  freebsd='freebsd',
  openbsd='openbsd',
  solaris='solaris'
}

enum system_arch_enum {
    x86="x86",
    amd64="amd64",
    x64="amd64",
    arm="arm",
    arm64="arm64"
}

// Determine the system's OS and architecture
const getSystemInfo = () => {
  const platform = os.platform();
  const arch = os.arch();

  const osMap: Record<string, system_os_enum> = {
    darwin: system_os_enum.macos,
    win32: system_os_enum.windows,
    linux: system_os_enum.linux,
    freebsd: system_os_enum.freebsd,
    openbsd: system_os_enum.openbsd,
    sunos: system_os_enum.solaris
  };

  const archMap: Record<string, system_arch_enum> = {
    x86: system_arch_enum.x86,
    amd64: system_arch_enum.amd64,
    x64: system_arch_enum.x64,
    arm: system_arch_enum.arm,
    arm64: system_arch_enum.amd64
  }

  const systemOs = osMap[platform];
  if (!systemOs) {
    throw new Error(`Unsupported OS: ${platform}`);
  }

  const systemArch = archMap[arch];
  if (!systemArch) {
    throw new Error(`Unsupported Architecture: ${arch}`);
  }

  return { os: systemOs, arch: systemArch };
};

// Check if binary exists and is working
const isBinaryWorking = async (binaryPath: string): Promise<boolean> => {
  try {
    const { stdout } = await execPromise(`${binaryPath} --version`);
    return stdout.trim().startsWith('Terraform');
  } catch {
    return false;
  }
};

// Download and unzip the binary
const downloadAndUnzip = async (url: string, destFolder: string, version: string, systemOS: string, arch: string): Promise<string> => {
  const zipFilePath = path.join(destFolder, `terraform-${version}-${systemOS}-${arch}.zip`);

  // Download the zip file
  const writer = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  await new Promise((resolve, reject) => {
    const stream = writer.data.pipe(createWriteStream(zipFilePath));
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Extract the binary
  await fs.mkdir(destFolder, { recursive: true });
  await createReadStream(zipFilePath).pipe(unzipper.Extract({ path: destFolder })).promise();

  // Delete the zip file
  await fs.unlink(zipFilePath);

  const executablePath = path.join(destFolder, 'terraform');
  const executableNewPath = path.join(destFolder, `terraform-${version}-${systemOS}-${arch}`);
  if (!existsSync(executablePath)) {
    throw new Error('Terraform binary could not be downloaded');
  }

  await fs.rename(executablePath, executableNewPath);
  await fs.chmod(executableNewPath, 0o755);

  return executableNewPath;
};

const deleteOtherExistingBinaries = async (directory: string, exceptThis: string): Promise<void> => {
  try {
    // Read all files in the directory
    const files = await fs.readdir(directory);

    // Iterate through the files and delete those that don't match `exceptThis`
    for (const file of files) {
      const filePath = path.join(directory, file);

      // Skip if it's the file to be kept
      if (file === exceptThis) {
        console.log(`Skipping file: ${file}`);
        continue;
      }

      // Delete the file
      await fs.unlink(filePath);
      console.log(`Deleted file: ${file}`);
    }
  } catch (error) {
    console.error(`Error while deleting files: ${(error as Error).message}`);
    throw error;
  }
};

// Main function to check and download the Terraform binary
export const ensureTerraformBinary = async (version: keyof typeof terraformPaths = TERRAFORM_VERSION) => {
  try {
    const { os: systemOs, arch } = getSystemInfo();
    const terraformVersion = terraformPaths[version];

    const osData = terraformVersion[systemOs];
    if (!osData) {
      throw new Error(`Unsupported OS for Terraform: ${systemOs}`);
    }

    const downloadUrl = (osData as Record<system_arch_enum, string>)[arch];
    if (!downloadUrl) {
      throw new Error(`Unsupported architecture for Terraform on ${systemOs}: ${arch}`);
    }

    const binaryPath = path.join(BINARY_FOLDER, `terraform-${version}-${systemOs}-${arch}`);
    const binaryExists = await fs.stat(binaryPath).then(() => true).catch(() => false);

    if (binaryExists && (await isBinaryWorking(binaryPath))) {
      console.log('Terraform binary already exists and is working.');
      return;
    }

    console.log(`Downloading Terraform binary for ${systemOs}/${arch}...`);
    const downloadedBinaryPath = await downloadAndUnzip(downloadUrl, BINARY_FOLDER, version, systemOs, arch);

    if (!(await isBinaryWorking(downloadedBinaryPath))) {
      throw new Error('Downloaded Terraform binary is not working.');
    }

    await deleteOtherExistingBinaries(path.dirname(downloadedBinaryPath), path.basename(downloadedBinaryPath));
    
    console.log('Terraform binary is successfully downloaded and verified.');
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};