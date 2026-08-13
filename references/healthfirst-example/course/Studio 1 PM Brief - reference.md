# Team 04 Studio 1 PM Brief — 11 August 2026
# Team 04 Studio 1 PM 简报 — 2026 年 8 月 11 日

> **How to use this file / 使用方法**
>
> Read the Chinese notes first. Say the English lines in class. You do not
> need to read every word; use the English as a speaking guide.
>
> 先看中文解释，再在课堂上说英文。不要逐字朗读，把英文当作提示稿即可。

## 1. Tomorrow's activity / 明天的课堂活动

### What the Studio 1 agenda means / Studio 1 要求的意思

1. **Retrospective and stand-up demo** — briefly explain what the team has
   done, what is still limited, and what happens next.

   **回顾和 stand-up demo**：简短说明团队完成了什么、目前有什么限制、接下来做什么。

2. **Onboarding build review** — mentors may review the build and perform an
   acceptance test during the class.

   **Onboarding build 检查**：导师可能在课堂上检查系统并进行验收测试。

3. **Peer usability test** — Team 04 tests the designated team TM03. We do not
   need to record a usability test of our own project.

   **同伴 usability test**：Team 04 测试指定的 TM03。我们不需要录制自己项目的 usability test。

4. **PGP evidence** — save the TM03 test recording and a short written result
   in the Project Governance Portfolio.

   **PGP 证据**：把 TM03 的测试录像和简短结果放进 Project Governance Portfolio。

### Important words / 重要术语

- **PM (Project Manager)** — the person who coordinates people, timing,
  evidence and handoffs. 项目经理，负责协调人员、时间、证据和交接。
- **MVP (Minimum Viable Product)** — the smallest working version for the
  current iteration. 最小可用版本，不是完整产品。
- **PGP** — Project Governance Portfolio, the folder/document where we keep
  project evidence. 项目治理档案，保存测试、决定和记录的地方。
- **Usability test** — ask another team to use the system and record what is
  clear or difficult. 可用性测试，让另一组使用系统并记录哪里清楚、哪里困难。
- **Acceptance test** — check whether the build meets the agreed criteria.
  验收测试，检查系统是否满足已同意的要求。

## 2. Our project in one minute / 一分钟介绍项目

### English to say / 课堂英文

> HealthFirst is an educational health-screening prototype for middle-aged
> Malaysian users. A user manually enters supported screening values, reviews
> and confirms them, and then receives an illustrative result with source
> labels, Malaysian population context and practical next-step guidance.
>
> It is not a diagnosis, disease prediction or emergency service. We use
> synthetic demo data only. OCR and report upload, as well as the pathway for
> users without previous screening, remain in the backlog. The current
> thresholds are illustrative placeholders until the approved method is
> confirmed.

### 中文意思 / 中文解释

HealthFirst 是一个面向马来西亚中年用户的健康筛查教育原型。用户手动输入健康检查数值，先检查和确认，再看到带有来源、马来西亚人口背景和下一步建议的示例结果。

它不是医疗诊断、疾病预测或急救服务。我们只使用 synthetic demo data（合成演示数据）。OCR、报告上传以及“没有既往筛查记录”的流程仍在 backlog（待办列表）中。当前 threshold（阈值）只是 illustrative placeholder（示例占位规则），等待正式方法确认。

## 3. PM stand-up script / PM stand-up 发言稿

### English to say / 课堂英文

> Hi, I’m Huang Guan, the PM for Team 04. Our MVP is a manual health-screening
> flow for middle-aged Malaysian users. A user enters supported values, checks
> the review screen, confirms the inputs, and receives an illustrative result
> with source-labelled explanations and next-step guidance.
>
> The integrated build is on the latest `main` branch. We use synthetic data
> only, and OpenRouter is disabled for the demo. Today we are ready for mentor
> review and for our peer usability test with TM03. Our main limitations are
> the illustrative thresholds, the disabled external AI path and OCR/report
> upload remaining in the backlog.

### 中文意思 / 中文解释

你好，我是 Team 04 的 PM Huang Guan。我们的 MVP 是一个面向马来西亚中年用户的手动健康筛查流程。用户输入支持的数值，检查 review 页面，确认后得到带有来源解释和下一步建议的示例结果。

当前整合代码在最新的 `main` 分支上。我们只使用合成数据，demo 中关闭了 OpenRouter。今天我们准备接受导师检查，并测试 TM03。主要限制是阈值仍是示例规则，外部 AI 已关闭，OCR/报告上传仍在 backlog。

### If you are nervous / 如果紧张，只说这个短版本

> Our project helps users review health screening values and understand the
> next step. It is an educational MVP, not a diagnosis. Today we will show the
> build and test TM03 as our peer team.

中文：我们的项目帮助用户检查健康筛查数值并理解下一步。它是教育性质的 MVP，不是诊断系统。今天我们展示系统，并对 TM03 做同伴测试。

## 4. Technical picture for a beginner PM / PM 需要懂的技术图

### English summary / 英文总结

> The frontend runs on port 8000. It sends a confirmed request to the FastAPI
> backend on port 5001. The backend validates the request, recomputes BMI,
> creates the result indicators and stores confirmed fields in the configured
> demo database. The frontend then displays the result cards.

### 中文解释

- **Frontend / 前端**：用户看到的网页，端口是 `8000`。
- **Backend / 后端**：处理数据和规则的 FastAPI/Python 服务，端口是 `5001`。
- **API**：前端和后端传数据的接口，这里是 `POST /api/assess`。
- **BMI recomputation / BMI 重新计算**：后端根据身高和体重重新算 BMI，不相信用户传来的 BMI。
- **Database / 数据库**：默认是 SQLite；设置 `DATABASE_URL` 后可以使用 PostgreSQL。
- **Action card / 行动卡片**：给用户的下一步建议，目前使用 rule-based fallback（规则式后备逻辑）。
- **OpenRouter**：外部 AI 服务。明天 demo 不启用，不能输入真实健康数据。

## 5. Demo flow and handoff / Demo 流程和队友交接

### Step 1 — Enter data / 第一步：输入数据

**Qian / Jiang** navigates the frontend and enters prepared synthetic values.

Qian/Jiang 负责操作前端，输入事先准备好的合成数据。

Say:

> We are using illustrative values for the demonstration. The form checks the
> required fields and shows a message when an input is invalid.

中文：我们使用示例数值进行演示。表单会检查必填项，如果输入无效会显示提示。

### Step 2 — Review and confirm / 第二步：检查并确认

**Huang / PM** explains the review screen and confirmation gate.

Huang/PM 解释 review 页面和确认门槛。

Say:

> The user can review and edit the values before sending them. The assessment
> request is not sent until the user explicitly confirms the information.

中文：用户可以在发送前检查和修改数据。只有用户明确确认后，系统才会发送 assessment request。

### Step 3 — Backend and database / 第三步：后端和数据库

**LiHanXia** explains validation and BMI recomputation. **Keith** explains the
configured demo database.

LiHanXia 解释后端验证和 BMI 重新计算。Keith 解释 demo 数据库配置。

Say:

> The backend validates the confirmed request again and recomputes BMI from
> height and weight. This protects the calculation from a changed client value.

中文：后端会再次验证确认后的请求，并根据身高和体重重新计算 BMI，避免客户端篡改 BMI。

### Step 4 — Results and safety / 第四步：结果和安全边界

**Hnin / Darli** explains sources and the assessment-method boundary.
**Benshuai Su** explains the action card and disclaimer.

Hnin/Darli 解释来源和 assessment method 边界。Benshuai Su 解释行动卡片和免责声明。

Say:

> The result cards show a status, a source label and Malaysian population
> context. These are illustrative demo results, not a medical diagnosis. The
> action card gives general next-step guidance and does not tell a user to stop
> medication or claim that the user has a disease.

中文：结果卡片显示状态、来源和马来西亚人口背景。这些是示例结果，不是医疗诊断。行动卡片只提供一般性的下一步建议，不会要求用户停止服药，也不会声称用户患有某种疾病。

## 6. Team roles tomorrow / 明天的团队角色

| Team member | English role | 中文职责 |
|---|---|---|
| Huang Guan | Facilitator, PM, timekeeper and PGP evidence owner | 主持、PM、计时、负责把测试证据放入 PGP |
| Qian Jiang | Frontend navigator and recording check | 操作前端、检查录像是否正常 |
| LiHanXia | Backend/API technical support | 解释 API、验证和 BMI 计算 |
| Keith Chong | Database and storage support | 解释数据库、字段和存储边界 |
| Hnin Darli | Assessment method and source support | 解释 assessment method、来源和阈值限制 |
| Benshuai Su | Action-card, accessibility and safety support | 解释行动卡片、可访问性和安全措辞 |

If a teammate is unavailable, do not stop the activity. Huang can give the
short explanation and record the question for follow-up.

如果队友临时不在，不要让活动停下来。Huang 可以先做简短解释，把技术问题记录下来，之后再跟进。

## 7. TM03 peer usability test / TM03 同伴可用性测试

### What we need to do / 我们要做什么

Team 04 tests TM03. We do **not** need to create a usability video for our own
Team 04 project. We need to record the TM03 test and save the evidence in the
PGP.

Team 04 测试 TM03。我们**不需要**为自己的 Team 04 项目制作 usability video。我们需要录制 TM03 测试，并将证据保存到 PGP。

### English opening / 英文开场

> We are Team 04 conducting the peer usability test for TM03. We will observe
> the main task without leading the participant. Please think aloud and tell us
> what you expected to happen. We will record task completion, confusing steps,
> wording issues and one improvement suggestion. We will not use real personal
> or health data.

### 中文意思

我们是 Team 04，现在对 TM03 进行同伴可用性测试。我们会观察主要任务，但不会引导参与者。请参与者边操作边说出自己的想法。我们会记录任务是否完成、困惑步骤、文字问题和一个改进建议。我们不会使用真实个人或健康数据。

### Questions / 测试后问题

1. **Could you complete the main task without help?**
   你能在没有帮助的情况下完成主要任务吗？
2. **What did you expect to happen at that step?**
   在那一步你原本期望发生什么？
3. **Which screen or wording was unclear?**
   哪个页面或文字不清楚？
4. **Did any message rely only on colour?**
   有没有信息只依靠颜色来表达？
5. **What is one change that would make the task easier?**
   哪一个改变可以让任务更容易？

### PGP record / PGP 记录内容

Record these items:

记录以下内容：

- date and team tested / 日期和被测试团队；
- task and outcome / 任务和结果；
- observed issue / 观察到的问题；
- suggested change / 建议改动；
- tester names and roles / 测试者姓名和角色；
- recording link / 录像链接。

Do not record real names, health reports, account passwords or private data.

不要记录真实姓名、健康报告、账户密码或私人数据。

## 8. Before-class checklist / 上课前检查清单

- [ ] Pull the latest `main` branch. / 拉取最新 `main` 分支。
- [ ] Prepare one synthetic demo input. / 准备一组合成演示数据。
- [ ] Open GitHub, the DMP, Security Plan and PGP folder. / 打开 GitHub、DMP、Security Plan 和 PGP 文件夹。
- [ ] Keep the frontend and backend start commands ready. / 准备好前后端启动命令。
- [ ] Confirm no `OPENROUTER_API_KEY` is present. / 确认没有设置 `OPENROUTER_API_KEY`。
- [ ] Confirm the TM03 recording owner. / 确认谁负责录制 TM03 测试。
- [ ] Confirm where the recording will be uploaded. / 确认录像上传位置。
- [ ] Check whether the mentor requires a deployed URL. / 确认导师是否要求部署链接。
- [ ] Do not claim that a local-only demo is production-ready. / 不要声称本地 demo 已达到生产环境标准。

## 9. Likely questions and safe answers / 老师可能的问题和安全回答

### Is this a medical diagnosis? / 这是医疗诊断吗？

> No. It is an educational decision-support prototype. The thresholds and
> action card are illustrative. Users should discuss concerns with a qualified
> healthcare professional.

不是。这是教育性质的决策支持原型。阈值和行动卡片都是示例，用户有疑问时应该咨询合格的医疗专业人员。

### Why is OCR not shown? / 为什么没有 OCR？

> Manual entry is the current MVP path. OCR/report upload remains in the
> backlog until extraction quality, user confirmation and privacy controls are
> ready.

手动输入是当前 MVP 流程。OCR/报告上传要等提取质量、用户确认和隐私控制准备好后再做。

### Is external AI enabled? / 外部 AI 开启了吗？

> No. The demo uses the rule-based fallback. OpenRouter stays disabled and no
> real health data is sent to a third party.

没有。demo 使用规则式后备逻辑。OpenRouter 保持关闭，不会把真实健康数据发送给第三方。

### What happens to the values? / 输入的数据会怎样？

> After confirmation, supported values are sent to the demo backend and stored
> in the configured demo database. No name, contact detail or account is part
> of the current API.

确认后，支持的数值会发送到 demo 后端并保存到配置的 demo 数据库。当前 API 不包含姓名、联系方式或账户信息。

### What is still unfinished? / 还有什么没有完成？

> The current thresholds are illustrative, external AI is disabled, OCR is in
> the backlog, and production privacy/security controls are not claimed. We
> will record concrete test findings and use them to plan the next iteration.

当前阈值是示例规则，外部 AI 已关闭，OCR 在 backlog 中，生产环境的隐私和安全控制尚未声明完成。我们会记录具体测试发现，并据此安排下一轮工作。

## 10. Final PM reminder / PM 最后提醒

Your job is not to know every line of code. Your job is to keep the activity
moving, explain the scope honestly, give each question to the right teammate,
and make sure the evidence is saved.

你不需要知道每一行代码。你的工作是让活动顺利进行、诚实说明项目范围、把问题交给合适的队友，并确保测试证据被保存。

