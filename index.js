require("dotenv").config();
const { WakaTimeClient, RANGE } = require("wakatime-client");
const { Octokit } = require("@octokit/rest");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey
} = process.env;

const wakatime = new WakaTimeClient(wakatimeApiKey);

const octokit = new Octokit({ auth: `token ${githubToken}` });

async function main() {
  try {
    console.log("正在获取 WakaTime 统计数据...");
    const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
    console.log("获取到统计数据:", JSON.stringify(stats.data, null, 2));
    await updateGist(stats);
  } catch (error) {
    console.error(`执行失败: ${error}`);
    process.exit(1);
  }
}

function trimRightStr(str, len) {
  // Ellipsis takes 3 positions, so the index of substring is 0 to total length - 3.
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

async function updateGist(stats) {
  let gist;
  try {
    console.log(`正在获取 gist: ${gistId}`);
    gist = await octokit.gists.get({ gist_id: gistId });
    console.log("成功获取 gist");
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
    throw error;
  }

  const lines = [];
  for (let i = 0; i < Math.min(stats.data.languages.length, 5); i++) {
    const data = stats.data.languages[i];
    const { name, percent, text: time } = data;

    // 内容格式
    const line = [
      name.padEnd(11),
      time
        .replace(/hrs/g, "h")
        .replace(/mins/g, "m")
        .padEnd(9),
      generateBarChart(percent, 16),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];

    // const line = [
    //   trimRightStr(name, 10).padEnd(10),
    //   time.padEnd(14),
    //   generateBarChart(percent, 21),
    //   String(percent.toFixed(1)).padStart(5) + "%"
    // ];

    lines.push(line.join(" "));
  }

  if (lines.length == 0) {
    console.log("没有语言统计数据可更新，显示提示信息");
    lines.push("No coding activity this week");
    lines.push("-----------------------------");
    lines.push("Please check your WakaTime");
    lines.push("plugin configuration.");
  }

  console.log("准备更新 gist，内容:\n", lines.join("\n"));

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    console.log(`更新文件名: ${filename}`);
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `📊 Weekly development breakdown`,
          content: lines.join("\n")
        }
      }
    });
    console.log("gist 更新成功！");
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
    throw error;
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
}

(async () => {
  await main();
})();

// 添加一行注释
