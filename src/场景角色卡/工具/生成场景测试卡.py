from pathlib import Path
import base64
import json
from PIL import Image, PngImagePlugin

root = Path(__file__).resolve().parent.parent
dest = Path('D:/MyWorkSpace/数据集/酒馆/01')
data = {
    'name': '', 'description': '', 'personality': '', 'scenario': '', 'first_mes': '', 'mes_example': '',
    'creator_notes': '', 'system_prompt': '', 'post_history_instructions': '',
    'alternate_greetings': [], 'tags': [], 'creator': '', 'character_version': '',
    'extensions': {'tavern_helper': {'scripts': [], 'variables': {}}},
    'character_book': {'name': '', 'entries': []},
}
card = {'spec': 'chara_card_v2', 'spec_version': '2.0', 'data': data}
character_doc = (dest / '蕾拉妮角色卡.md').read_text(encoding='utf-8')
leilani = character_doc.split('```text', 1)[1].split('```', 1)[0].strip().replace('{{char}}', '蕾拉妮')
ailin = '''【艾琳｜测试角色】
艾琳是魔法学校的成年学员，银白色短发，一侧长刘海遮住眼睛，蓝色眼眸，穿深色披肩与黑白长裙。她观察细致、说话平静，熟悉后会露出温和的幽默；她尊重别人的选择，关心时更习惯提供实际帮助，不擅长把自己的脆弱说出口。艾琳和{{user}}目前是认识不久的同校学员，并非恋人；与蕾拉妮是同校相识的人。她有自己的事务和判断，不会为制造竞争而刻意针对蕾拉妮。随着真实互动，艾琳可以逐渐动心并主动表达；只有玩家接受界面中的表白后双方才是恋人。
'''
data['name'] = '月湖学院·双角色测试'
data['description'] = '你负责描写魔法学院的场景、旁白和多个人物。每个角色是独立的人物，根据世界书中的角色列表、角色详情和当前变量自然演绎，不替{{user}}决定行动、想法或台词。'
data['personality'] = '蕾拉妮：端庄聪慧、骄傲又细腻，是玩家青梅竹马。艾琳：沉静细心，熟悉后温柔而幽默，与玩家相识不久。'
data['scenario'] = '魔法学校湖畔的傍晚。蕾拉妮与{{user}}是青梅竹马，艾琳是相识不久的同校学员。角色各自行动，根据互动自然出场。'
data['first_mes'] = '''[旁白]
晚风掠过学院湖面，月影被细浪揉碎。蕾拉妮正在岸边等候，见到{{user}}后，平静的神情柔和了些。

[蕾拉妮.neutral]
“你来了。我刚才还在想，你是不是练习法印又忘了时间。”

[旁白]
不远处，艾琳合上手中的笔记，向两人走来。

[艾琳.neutral]
“晚上好。希望我没有打扰你们。”她朝湖面看了一眼，“我刚记下一个有趣的法印，正想找人讨论。”'''
data['mes_example'] = ''
data['creator_notes'] = '世界书角色列表测试卡：含角色设定、世界书、MVU 变量结构、默认立绘和 RPG 界面脚本。全局已运行 MVU 时勿重复启用角色内框架；建议新建聊天初始化。'
data['character_version'] = '世界书角色列表测试 2.0'
data['tags'] = ['双角色', 'MVU', '测试']

book = data['character_book']
book['name'] = '月湖学院_双角色_MVU'
template = root.parent.parent / '初始模板/角色卡/新建为src文件夹中的文件夹/世界书/变量'
def variable_entry(uid, name, content, enabled=True):
    return {
        'id': uid, 'keys': [], 'secondary_keys': [], 'comment': name, 'content': content,
        'constant': True, 'selective': False, 'insertion_order': 14720, 'enabled': enabled,
        'position': 'after_char' if enabled else 'before_char', 'use_regex': True,
        'extensions': {'position': 4 if enabled else 0, 'depth': 0, 'role': 0,
                       'probability': 100, 'useProbability': True,
                       'exclude_recursion': True, 'prevent_recursion': True},
    }
book['entries'] = [
    variable_entry(0, '[initvar]变量初始化勿开', (root / '世界书/双角色初始变量.yaml').read_text(encoding='utf-8'), False),
    variable_entry(1, '变量列表', (template / '变量列表.txt').read_text(encoding='utf-8-sig')),
    variable_entry(2, '[mvu_update]变量更新规则', (root / '世界书/变量更新规则.yaml').read_text(encoding='utf-8')),
    variable_entry(3, '[mvu_update]变量输出格式', (template / '变量输出格式.yaml').read_text(encoding='utf-8-sig')),
]
book['entries'].append({
    'id': max(e['id'] for e in book['entries']) + 1, 'keys': [], 'secondary_keys': [],
    'comment': '多角色输出格式', 'content': '叙事中每个角色的发言或动作之前，独占一行输出 [角色名.表情]；旁白前独占一行输出 [旁白]。表情只使用界面提供的可用列表。多角色可在一次回复中交替发言。不得替玩家决定言行。',
    'constant': True, 'selective': False, 'insertion_order': 14721, 'enabled': True,
    'position': 'after_char', 'use_regex': True, 'extensions': {'position': 4, 'depth': 0, 'role': 0},
})

def lore_entry(name, content, keys=None, position=4, depth=2, recursive=False):
    return {
        'id': max(e['id'] for e in book['entries']) + 1,
        'keys': keys or [], 'secondary_keys': [], 'comment': name, 'content': content,
        'constant': not keys, 'selective': False, 'insertion_order': 14720, 'enabled': True,
        'position': 'before_char' if position == 0 else 'after_char', 'use_regex': True,
        'extensions': {'position': position, 'depth': depth, 'role': 0, 'probability': 100,
                       'useProbability': True, 'exclude_recursion': not recursive,
                       'prevent_recursion': not recursive},
    }

book['entries'].append(lore_entry('角色列表', (root / '世界书/角色列表.yaml').read_text(encoding='utf-8')))
book['entries'].append(lore_entry('角色出场规则', '根据角色列表中的出场条件和剧情需要自然引入人物，平衡角色戏份，不强迫所有人物一起出场。'))
for name, details in [('蕾拉妮', leilani), ('艾琳', ailin)]:
    marker = f'〖〖{name}〗〗'
    book['entries'].append(lore_entry(f'{name}角色激活', marker, [name], position=0, recursive=True))
    book['entries'].append(lore_entry(f'{name}角色详情', details, [marker, name], position=1, recursive=True))

def image_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode('ascii')

roles = {
    '蕾拉妮': {'folder': '蕾拉妮', 'fallback': image_uri(dest / '角色立绘/蕾拉妮.png')},
    '艾琳': {'folder': '艾琳', 'fallback': image_uri(dest / '角色立绘/ComfyUI_00583_.png')},
}
config_script = '''$(() => {
  const host = window.parent;
  const config = CONFIG;
  host.__rpgSceneConfig = config;
  host.dispatchEvent(new Event('rpg-scene-config-changed'));
  $(window).on('pagehide', () => {
    if (host.__rpgSceneConfig === config) {
      delete host.__rpgSceneConfig;
      host.dispatchEvent(new Event('rpg-scene-config-changed'));
    }
  });
});'''.replace('CONFIG', json.dumps({'rosterFromWorldbook': True, 'roles': roles}, ensure_ascii=False))

def script(name, script_id, content, enabled=True):
    return {'name': name, 'id': script_id, 'type': 'script', 'enabled': enabled, 'content': content,
            'info': '', 'button': {'enabled': True, 'buttons': []}, 'data': {},
            'export_with': {'data': True, 'button': True}}

framework = script('MVU 框架（全局已加载时保持关闭）', '28091384-6b62-4a4f-911f-619ac66410d7',
                   "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';", False)
schema_source = (root / 'schema.ts').read_text(encoding='utf-8')
schema = script('变量结构', 'eb0a52a5-43d5-4e72-9fa4-d9ce40e0f4c0',
                "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\n"
                + schema_source + '\n$(() => { registerMvuSchema(Schema); });\n')
ui_path = root.parent.parent / 'dist/RPG游戏界面/index.js'
assert ui_path.exists(), '缺少构建后的 RPG 界面脚本'
data['extensions']['tavern_helper']['scripts'] = [
    framework, schema,
    script('世界书角色列表与内置默认立绘', 'c20440ef-5aba-4268-8700-9cd9221f2af3', config_script),
    script('RPG游戏界面（全局已运行时自动跳过）', 'a84988cc-abd2-46ad-9ac6-888430de3b95', ui_path.read_text(encoding='utf-8')),
]
for key in ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example']:
    card[key] = data[key]
raw = json.dumps(card, ensure_ascii=False, separators=(',', ':'))
out_json = dest / '月湖学院_世界书角色列表测试卡.json'
out_png = dest / '月湖学院_世界书角色列表测试卡.png'
out_json.write_text(raw, encoding='utf-8')
with Image.open(dest / '蕾拉妮第一版.png') as image:
    meta = PngImagePlugin.PngInfo()
    meta.add_text('chara', base64.b64encode(raw.encode('utf-8')).decode('ascii'))
    image.save(out_png, pnginfo=meta)
with Image.open(out_png) as image:
    assert json.loads(base64.b64decode(image.info['chara'])) == card
assert len(data['extensions']['tavern_helper']['scripts']) == 4
print(f'已生成并核对 {out_png.name} 与 JSON；角色 2 个，世界书条目 {len(book["entries"])} 个。')
