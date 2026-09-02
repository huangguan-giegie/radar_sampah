"""Radar Sampah Iteration 1 API.

The routes and response shapes in this module follow frontend/API.md and
frontend/API.en.md. Report coordinates and photo storage keys are private
server-side data and are deliberately excluded from response serializers.
"""

from __future__ import annotations

import json
import math
import os
import re
import secrets
from statistics import median
import tempfile
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import BytesIO
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode

import jwt
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from PIL import Image, ImageOps, UnidentifiedImageError
from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    insert,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException
from werkzeug.exceptions import RequestEntityTooLarge

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover - dependency is installed in deployed builds
    register_heif_opener = None


# Local development settings are intentionally loaded from the ignored .env.
load_dotenv(Path(__file__).with_name(".env"))


# hx：一些全局固定参数。KUALA_LUMPUR 是 UTC+8，判断"是不是同一天"（查重规则）
# 一律按吉隆坡当地日期算，不是 UTC 日期
LOCAL_DATABASE_URL = "sqlite:///radar_sampah.db"
KUALA_LUMPUR = timezone(timedelta(hours=8))
AUTH_JWT_ALGORITHM = "HS256"
AUTH_TOKEN_TTL_DAYS = 30
PHOTO_URL_TTL_MINUTES = 15
PHOTO_MAX_BYTES = 10 * 1024 * 1024
PHOTO_MAX_EDGE = 2048
PHOTO_ORPHAN_TTL = timedelta(hours=24)
PARTICIPANT_ID_MIN = 1000
PARTICIPANT_ID_MAX = 9999
DEFAULT_VOLUNTEER_ROLE = "volunteer"

# hx：六个垃圾品类的权重和四档数量的权重，两者相乘就是一条记录里某个品类的分数，
# 这组数字要跟前端 scoring.ts 完全一致，不能后端一套、前端一套
FRONTEND_CATEGORIES = ("Fishing gear", "Plastic", "Glass", "Metal", "Other", "Paper")
CATEGORY_WEIGHTS = {
    "Fishing gear": 1.0,
    "Plastic": 0.85,
    "Glass": 0.70,
    "Metal": 0.60,
    "Other": 0.50,
    "Paper": 0.35,
}
QUANTITY_WEIGHTS = {"Small": 1, "Medium": 2, "Large": 3, "Very Large": 4}
# hx：一条举报只有三种状态：Counted（计入统计）、Duplicate（同一天重复举报，
# 存下来但不计入）、Incomplete（照片读取失败，需要用户修正）——没有"待审核"状态，
# 提交的时候就同步判定完，不走人工审核流程
REPORT_STATUSES = {"Counted", "Duplicate", "Incomplete"}
REPORT_STATUS_NOTES = {
    "Duplicate": "Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.",
    "Incomplete": "Photo unreadable — excluded until you correct and save the report.",
}
SCORING_BANDS = (
    {"band": "Low", "range": "below 1.5", "color": "#7CA98B"},
    {"band": "Moderate", "range": "1.5 – <2.5", "color": "#D9A24B"},
    {"band": "High", "range": "2.5 – <3.5", "color": "#CE6B45"},
    {"band": "Severe", "range": "3.5 and above", "color": "#B84A3F"},
)
PHOTO_MIME_TYPES = {"image/jpeg", "image/png", "image/heic", "image/heif"}
REPORT_INPUT_FIELDS = {"beachId", "quantities", "photoKey", "locationSource", "coords"}
BEACH_SUMMARY_FIELDS = (
    "id",
    "name",
    "area",
    "lat",
    "lng",
    "habitat",
    "habitatTag",
    "sensitivity",
    "primarySpeciesGlyph",
    "speciesNames",
    "coverImageUrl",
    "scene",
)


# hx：users 表只存参与者编号和角色，没有姓名、邮箱、密码这些个人信息字段——
# 这是"不做真实身份系统"这条安全原则在数据库层面的落地
metadata = MetaData()
users_table = Table(
    "users",
    metadata,
    Column("id", String(80), primary_key=True),
    Column("participant_id", String(4), nullable=False, unique=True),
    Column("role", String(20), nullable=False, default=DEFAULT_VOLUNTEER_ROLE),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

# The database contract in schema.sql stores one nullable column per litter
# category.  Keep this mapping at the boundary so the API can continue to use
# the frontend's compact `{category: quantity}` shape.
# hx：数据库负责人的 schema.sql 是每个品类单独一列（qty_plastic 等，NULL 表示
# "没看到这个品类"，不能用 0，因为没人数过等于 0 是两回事），
# 但前端传的是 {"Plastic": "Large"} 这种紧凑的字典格式，这个映射表就是
# 用来在两种表示法之间转换的
QUANTITY_COLUMNS = {
    "Plastic": "qty_plastic",
    "Fishing gear": "qty_fishing_gear",
    "Glass": "qty_glass",
    "Metal": "qty_metal",
    "Paper": "qty_paper",
    "Other": "qty_other",
}

# hx：这张表存了 lat/lng 两列，但只在 GPS 来源时才会写入，
# 而且序列化返回给前端时（见 report_dict）会特意排除这两列，绝不对外暴露精确坐标
reports_table = Table(
    "reports",
    metadata,
    Column("id", String(40), primary_key=True),
    Column("reporter_id", ForeignKey("users.id"), nullable=False),
    Column("beach_id", String(80), nullable=False),
    # Legacy PR #13 columns. Existing Render tables may still require these
    # fields, so new writes keep both representations in sync during migration.
    Column("beach_name", String(160)),
    Column("quantities", Text),
    Column("location_source", String(20), nullable=False),
    Column("photo_key", String(500), nullable=False),
    Column("photo_mime", String(64), nullable=False),
    Column("photo_stripped", Boolean, nullable=False, default=False),
    *(Column(column, String(20)) for column in QUANTITY_COLUMNS.values()),
    Column("category", String(40), nullable=False),
    Column("quantity", String(20), nullable=False),
    Column("lat", Float),
    Column("lng", Float),
    Column("status", String(20), nullable=False),
    Column("status_note", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("deleted_at", DateTime(timezone=True)),
)


# hx：Render 给的连接串是 postgres://，SQLAlchemy 2.x 要求 postgresql+psycopg://，
# 这里统一转换；本地没配置 DATABASE_URL 时用 SQLite 兜底
def normalise_database_url(database_url: str | None) -> str:
    value = (database_url or LOCAL_DATABASE_URL).strip()
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


# hx：SQLite 多线程要关掉 same-thread 检查；用 Postgres（Neon）时，
# 连接池可能在事务之间重置 search_path 这种会话设置，所以改用 SQLAlchemy
# 自带的 schema_translate_map（在编译 SQL 语句这一层直接把表名翻译成带 schema 的），
# 而不是指望连接层面的 SET search_path 一直生效
def create_engine_for_url(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, future=True, connect_args=connect_args)
    if database_url.startswith("sqlite"):
        return engine
    # Neon poolers can reset session settings between transactions. Translate
    # unqualified SQLAlchemy tables into the configured schema at compile time
    # instead of relying on a connection-level `SET search_path`.
    schema = database_schema()
    return engine.execution_options(schema_translate_map={None: schema}) if schema else engine


# hx：可选的 PostgreSQL schema 名，从环境变量读；校验一下格式（只能是字母/数字/
# 下划线），防止这个值被拼进原始 SQL 语句时出现注入风险
def database_schema() -> str | None:
    schema = os.getenv("DATABASE_SCHEMA", "").strip()
    if not schema:
        return None
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", schema):
        raise RuntimeError("DATABASE_SCHEMA must be a valid PostgreSQL schema name")
    return schema


# hx：启动时依次做几件事——把旧表名迁移过来、建表、按需建一个演示用的固定编号账号、
# 给旧表补缺的列、把历史数据修正成符合最新规则的状态
def initialise_database(engine: Engine) -> None:
    """Create the schema and preserve reports written under the former name."""
    migrate_legacy_reports_table(engine)
    metadata.create_all(engine)
    ensure_demo_participant(engine)
    ensure_report_columns(engine)
    repair_existing_reports(engine)


# hx：给演示/讲解用的，如果配置了 DEMO_PARTICIPANT_ID 环境变量，
# 就预先建一个固定编号的空账号，方便演示时直接用这个号找回、不用现场注册；
# 编号格式不对或者这个用户 id 已经被别的编号占用了都会直接报错，不会静默出错
def ensure_demo_participant(engine: Engine) -> None:
    """Optionally create one empty, anonymous participant for controlled demos."""
    participant_id = os.getenv("DEMO_PARTICIPANT_ID", "").strip()
    if not participant_id:
        return
    if not re.fullmatch(r"\d{4}", participant_id):
        raise RuntimeError("DEMO_PARTICIPANT_ID must be a four-digit participant ID")

    user_id = f"u_demo_{participant_id}"
    with engine.begin() as connection:
        participant = connection.execute(
            select(users_table.c.id).where(users_table.c.participant_id == participant_id)
        ).first()
        if participant is not None:
            return

        conflicting_user = connection.execute(
            select(users_table.c.participant_id).where(users_table.c.id == user_id)
        ).first()
        if conflicting_user is not None:
            raise RuntimeError(f"Demo user ID {user_id} is already assigned to another participant")

        connection.execute(
            insert(users_table).values(
                id=user_id,
                participant_id=participant_id,
                role=DEFAULT_VOLUNTEER_ROLE,
                created_at=datetime.now(timezone.utc),
            )
        )


# hx：早期版本的表叫 frontend_reports，后来统一改名叫 reports；
# 这个函数在 metadata.create_all 之前跑，把旧表名 ALTER RENAME 成新名字，
# 这样老数据库升级上来时旧数据不会丢，也不会因为表名对不上而重复建一张空表
def migrate_legacy_reports_table(engine: Engine) -> None:
    """Rename the pre-PR-13 table before SQLAlchemy creates ``reports``.

    The standalone PostgreSQL equivalent lives in migrations/001_*.sql.  This
    startup guard keeps local SQLite databases and Render deployments safe when
    the migration has not been run as a separate release step.
    """
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    table_names = set(inspect(engine).get_table_names(schema=schema))
    if "frontend_reports" not in table_names or "reports" in table_names:
        return
    legacy_table = "frontend_reports" if schema is None else f'"{schema}".frontend_reports'
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {legacy_table} RENAME TO reports"))


# hx：metadata.create_all 只会建全新的表，不会给已经存在的旧表补列，
# 所以这里手动检查 reports 表缺哪些列（照片信息、各品类数量列、坐标、
# 状态备注、更新/软删时间），缺了就用 ALTER TABLE 补上，
# 保证老数据库升级后新字段也能正常读写
def ensure_report_columns(engine: Engine) -> None:
    """Add contract fields that were absent from the former partial table."""
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    if "reports" not in inspect(engine).get_table_names(schema=schema):
        return
    existing = {column["name"] for column in inspect(engine).get_columns("reports", schema=schema)}
    additions = {
        "photo_mime": "VARCHAR(64)",
        "photo_stripped": "BOOLEAN",
        **{column: "VARCHAR(20)" for column in QUANTITY_COLUMNS.values()},
        "lat": "DOUBLE PRECISION",
        "lng": "DOUBLE PRECISION",
        "status_note": "TEXT",
        "updated_at": "TIMESTAMP WITH TIME ZONE",
        "deleted_at": "TIMESTAMP WITH TIME ZONE",
    }
    report_table = "reports" if schema is None else f'"{schema}".reports'
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {report_table} ADD COLUMN {name} {sql_type}"))


# hx：旧数据可能是用老的 {"Plastic":"Large"} 这种 JSON 字符串存的，还没拆分到
# qty_plastic 这些独立列里，这个函数按创建时间重新走一遍：拆出 category/quantity，
# 并按"同一举报人+同一海滩+同一吉隆坡日期"重新判定谁是 Counted、谁是 Duplicate，
# 让历史数据跟现在的规则保持一致
def repair_existing_reports(engine: Engine) -> None:
    """Backfill quantity columns and retain duplicate handling for legacy rows."""
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    columns = {column["name"] for column in inspect(engine).get_columns("reports", schema=schema)}
    if "quantities" not in columns:
        return
    report_table = "reports" if schema is None else f'"{schema}".reports'
    with engine.begin() as connection:
        rows = connection.execute(text(
            f"SELECT id, reporter_id, beach_id, quantities, status, created_at FROM {report_table} "
            "ORDER BY created_at, id"
        )).mappings().all()
        first_counted_by_day: set[tuple[str, str, Any]] = set()
        for row in rows:
            try:
                quantities = json.loads(row["quantities"])
                category, quantity = derive_category_quantity(quantities)
            except (TypeError, ValueError, StopIteration):
                continue
            status = row["status"]
            if status != "Incomplete":
                created_at = row["created_at"]
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                local_day = utc_datetime(created_at).astimezone(KUALA_LUMPUR).date()
                duplicate_key = (row["reporter_id"], row["beach_id"], local_day)
                status = "Duplicate" if duplicate_key in first_counted_by_day else "Counted"
                first_counted_by_day.add(duplicate_key)
            values: dict[str, Any] = {"category": category, "quantity": quantity, "status": status}
            values.update(quantity_values(quantities))
            set_clause = ", ".join(f"{name} = :{name}" for name in values)
            connection.execute(
                text(f"UPDATE {report_table} SET {set_clause} WHERE id = :id"),
                {**values, "id": row["id"]},
            )


# hx：四个海滩的信息优先从数据库读（数据库负责人维护的种子数据），
# 数据库里没有这张表或者没数据时，就退回读本地 beaches.json 兜底
# （主要是给本地测试用，不依赖数据库也能跑）
def load_beaches(engine: Engine | None = None) -> list[dict[str, Any]]:
    """Prefer the seeded database records, with JSON only as local-test fallback."""
    with (Path(__file__).parent / "data" / "beaches.json").open(encoding="utf-8") as data_file:
        fallback = json.load(data_file)
    schema = database_schema() if engine is not None and engine.dialect.name != "sqlite" else None
    if engine is None or "beaches" not in inspect(engine).get_table_names(schema=schema):
        return fallback
    beach_table = "beaches" if schema is None else f'"{schema}".beaches'
    with engine.connect() as connection:
        rows = connection.execute(
            text(f"""
                SELECT id, name, area, lat, lng, habitat, habitat_tag, sensitivity,
                       primary_species_glyph, cover_image_url, scene, ecological_note
                FROM {beach_table} ORDER BY id
            """)
        ).mappings().all()
    if not rows:
        return fallback
    fallback_by_id = {beach["id"]: beach for beach in fallback}
    beaches: list[dict[str, Any]] = []
    for row in rows:
        base = fallback_by_id.get(row["id"], {})
        beaches.append(
            {
                **base,
                "id": row["id"], "name": row["name"], "area": row["area"],
                "lat": row["lat"], "lng": row["lng"], "habitat": row["habitat"],
                "habitatTag": row["habitat_tag"], "sensitivity": row["sensitivity"],
                "primarySpeciesGlyph": row["primary_species_glyph"],
                "coverImageUrl": row["cover_image_url"], "scene": row["scene"],
                "ecologicalNote": row["ecological_note"],
            }
        )
    return beaches


# hx：统一的错误返回格式，前端靠 code 字段判断具体是哪种错误
def error_response(status: int, code: str, message: str):
    return jsonify({"code": code, "message": message}), status


# hx：JWT 签名密钥必须从环境变量 AUTH_JWT_SECRET 读，正式环境没配置就直接报错、
# 不允许用写死的默认密钥兜底；只有跑测试的时候才允许用一个仅供测试的固定值
def auth_jwt_secret(testing: bool) -> str:
    secret = os.getenv("AUTH_JWT_SECRET", "").strip()
    if secret:
        return secret
    if testing:
        return "test-only-secret-not-for-production"
    raise RuntimeError("AUTH_JWT_SECRET must be configured outside tests")


# hx：从 1000-9999 里随机挑一个还没被占用的编号（用随机而不是递增，
# 是为了不让人从编号大小推算出"现在一共注册了多少人"）；
# 9000 个编号全被占用这种极端情况会直接报错，不会静默失败
def generate_participant_id(connection: Any) -> str:
    taken = set(connection.execute(select(users_table.c.participant_id)).scalars().all())
    available = [str(value) for value in range(PARTICIPANT_ID_MIN, PARTICIPANT_ID_MAX + 1) if str(value) not in taken]
    if not available:
        raise RuntimeError("No participant IDs are available")
    return secrets.choice(available)


# hx：签发登录 token，把用户 id 放进 JWT 里，30 天后过期，不做续期
def issue_token(user_id: str, jwt_secret: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(days=AUTH_TOKEN_TTL_DAYS)},
        jwt_secret,
        algorithm=AUTH_JWT_ALGORITHM,
    )


# hx：解析 token 拿到用户 id；缺失、过期、被篡改、格式不对都统一返回 None，
# 交给调用方按"未登录"处理
def decode_token_subject(token: str, jwt_secret: str) -> str | None:
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[AUTH_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None


# hx：把数据库里的一行 user 记录转成接口要返回的 JSON——只有这三个字段，
# 没有姓名/邮箱这些字段可返回，因为数据库里本来就没存
def user_dict(row: Any) -> dict[str, Any]:
    return {"id": row.id, "participantId": row.participant_id, "role": row.role}


# hx：数据库里存的时间可能没带时区（旧数据），统一补成 UTC，方便后面比较
def utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# hx：接口对外返回的时间统一转成吉隆坡时区的 ISO 字符串
def contract_timestamp(value: datetime) -> str:
    return utc_datetime(value).astimezone(KUALA_LUMPUR).isoformat()


def derive_category_quantity(quantities: dict[str, str]) -> tuple[str, str]:
    """选择类别分数最高的类别；相同分数按固定类别顺序稳定决胜。"""

    best_category = next(category for category in FRONTEND_CATEGORIES if category in quantities)
    best_score = CATEGORY_WEIGHTS[best_category] * QUANTITY_WEIGHTS[quantities[best_category]]
    for category in FRONTEND_CATEGORIES:
        quantity = quantities.get(category)
        if quantity is None:
            continue
        score = CATEGORY_WEIGHTS[category] * QUANTITY_WEIGHTS[quantity]
        if score > best_score:
            best_category, best_score = category, score
    return best_category, quantities[best_category]


def category_scores_for(quantities: dict[str, str]) -> dict[str, float]:
    """按公开类别顺序返回每个已填类别的分数。"""

    return {
        category: CATEGORY_WEIGHTS[category] * QUANTITY_WEIGHTS[quantities[category]]
        for category in FRONTEND_CATEGORIES
        if category in quantities
    }


# hx：一条举报的总分，取里面所有品类分数中最高的那个（不是求和，
# 一条记录报的品类越多不会让分数跟着无限往上叠）
def report_score_for(quantities: dict[str, str]) -> float:
    return max(category_scores_for(quantities).values())


# hx：把数据库那一行（qty_plastic/qty_glass 这些独立列）转回
# {"Plastic": "Large"} 这种紧凑字典，只保留非空的品类
def quantities_from_row(row: Any) -> dict[str, str]:
    return {
        category: getattr(row, column)
        for category, column in QUANTITY_COLUMNS.items()
        if getattr(row, column) is not None
    }


# hx：反过来，把紧凑字典转成要写进数据库那几个独立列的字典，方便 insert/update 时展开
def quantity_values(quantities: dict[str, str]) -> dict[str, str | None]:
    return {column: quantities.get(category) for category, column in QUANTITY_COLUMNS.items()}


# hx：算一个海滩的"关注度分数"——少于 3 条有效记录直接返回 None
# （前端会显示"数据不足"，不能编一个假分数），够 3 条就取所有记录分数的中位数
# （用中位数而不是平均数，是为了不让个别极端值把结果拉偏）
def attention_score_for(rows: list[Any]) -> float | None:
    if len(rows) < 3:
        return None
    scores = [report_score_for(quantities_from_row(row)) for row in rows]
    return float(median(scores))


# hx：把关注度分数按四个固定区间分成 Low/Moderate/High/Severe 四档
def severity_for(rows: list[Any]) -> tuple[str | None, int | None]:
    score = attention_score_for(rows)
    if score is None:
        return None, None
    if score < 1.5:
        return "Low", 1
    if score < 2.5:
        return "Moderate", 2
    if score < 3.5:
        return "High", 3
    return "Severe", 4


# hx：拼一个海滩的汇总信息给地图/列表用。severity 只看最近 90 天内的 Counted 记录，
# 但 lastReportedAt/freshnessKind（多久没人举报了）不受 90 天窗口限制——
# 因为"很久没人报告了"本身就是有意义的信息，不能因为超出窗口就当没发生过
def beach_summary(engine: Engine, beach: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    cutoff = current_time - timedelta(days=90)
    with engine.connect() as connection:
        all_counted = connection.execute(
            select(reports_table).where(
                reports_table.c.beach_id == beach["id"],
                reports_table.c.status == "Counted",
            )
        ).all()
    eligible = [row for row in all_counted if utc_datetime(row.created_at) >= cutoff]
    attention_score = attention_score_for(eligible)
    severity, band = severity_for(eligible)
    newest = max(all_counted, key=lambda row: utc_datetime(row.created_at), default=None)
    newest_at = utc_datetime(newest.created_at) if newest else None
    if newest_at is None:
        freshness = "stale"
    else:
        age = current_time - newest_at
        freshness = "ok" if age < timedelta(days=30) else "aging" if age <= timedelta(days=90) else "stale"
    summary = {field: beach[field] for field in BEACH_SUMMARY_FIELDS}
    summary.update(
        {
            "severity": severity,
            "band": band,
            "insufficientData": severity is None,
            "validReports": len(eligible),
            "attentionScore": round(attention_score, 2) if attention_score is not None else None,
            "eligibleReportCount": len(eligible),
            "lastReportedAt": contract_timestamp(newest.created_at) if newest else None,
            "freshnessKind": freshness,
        }
    )
    return summary


# hx：照片不进数据库，存在服务器本地一个私有目录里（不在公网可访问的静态目录下）；
# 没配置 PHOTO_STORAGE_DIR 环境变量时用系统临时目录兜底
def photo_storage_path(configured: str | Path | None) -> Path:
    value = configured or os.getenv("PHOTO_STORAGE_DIR")
    path = Path(value) if value else Path(tempfile.gettempdir()) / "radar-sampah-private-photos"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


# hx：根据 photo_key 算出照片文件的真实路径；先校验 key 的格式（32 位十六进制+.jpg），
# 再确认拼出来的路径确实还在存储目录里面——防止有人传一个 "../../etc/passwd"
# 之类的 key 跳出目录去读别的文件（路径穿越攻击）
def photo_file_path(directory: Path, photo_key: str) -> Path | None:
    if not re.fullmatch(r"[0-9a-f]{32}\.jpg", photo_key):
        return None
    path = (directory / photo_key).resolve()
    return path if directory in path.parents else None


# hx：每张照片旁边存一个同名的 .meta.json，记录归属人、上传时间、格式、
# 是否已经剥离过 EXIF 信息
def photo_metadata_path(directory: Path, photo_key: str) -> Path | None:
    photo_path = photo_file_path(directory, photo_key)
    return photo_path.with_name(photo_path.name + ".meta.json") if photo_path else None


# hx：读取照片的元数据文件，文件不存在或损坏都返回 None（不抛异常）
def read_photo_metadata(directory: Path, photo_key: str) -> dict[str, Any] | None:
    path = photo_metadata_path(directory, photo_key)
    if path is None or not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


# hx：写入照片的元数据文件
def write_photo_metadata(directory: Path, photo_key: str, value: dict[str, Any]) -> None:
    path = photo_metadata_path(directory, photo_key)
    assert path is not None
    path.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")


# hx：处理上传的原始照片——用 exif_transpose 先按 EXIF 里的旋转信息摆正图片，
# 再把长边压缩到 2048px 以内，最后重新存成 JPEG。因为是重新生成一张全新的图片
# （而不是在原文件上删字段），所以包括 GPS 在内的所有 EXIF 元数据都会被自然剥离掉，
# 不是「假装剥离」；读取失败（图片损坏/格式不对）就抛出明确的错误信息
def process_photo(raw: bytes) -> bytes:
    try:
        with Image.open(BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source)
            image.thumbnail((PHOTO_MAX_EDGE, PHOTO_MAX_EDGE), Image.Resampling.LANCZOS)
            if image.mode not in {"RGB", "L"}:
                background = Image.new("RGB", image.size, "white")
                if "A" in image.getbands():
                    background.paste(image, mask=image.getchannel("A"))
                else:
                    background.paste(image)
                image = background
            elif image.mode == "L":
                image = image.convert("RGB")
            output = BytesIO()
            image.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ValueError("The photo could not be read. Please choose another image.") from error


# hx：给照片生成一个短时效（15 分钟）的签名访问链接，只有照片的主人才能拿到这个链接
# （<img> 标签没法带 Authorization 请求头，所以只能靠 URL 里带一次性 token 来鉴权，
# 这是标准做法，类似 S3/GCS 的签名 URL），不是直接把照片文件路径暴露出去
def signed_photo_url(photo_key: str, owner_id: str, jwt_secret: str, directory: Path) -> str | None:
    metadata_value = read_photo_metadata(directory, photo_key)
    path = photo_file_path(directory, photo_key)
    if metadata_value is None or metadata_value.get("ownerId") != owner_id or path is None or not path.is_file():
        return None
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": owner_id,
            "photoKey": photo_key,
            "purpose": "photo-preview",
            "iat": now,
            "exp": now + timedelta(minutes=PHOTO_URL_TTL_MINUTES),
        },
        jwt_secret,
        algorithm=AUTH_JWT_ALGORITHM,
    )
    return request.host_url.rstrip("/") + "/uploads/photos/" + photo_key + "?" + urlencode({"token": token})


# hx：把一张照片的文件和它的元数据 json 一起删掉
def delete_photo(directory: Path, photo_key: str) -> None:
    for path in (photo_file_path(directory, photo_key), photo_metadata_path(directory, photo_key)):
        if path is not None and path.is_file():
            path.unlink(missing_ok=True)


# hx：只有在没有任何举报记录引用这张照片时才真的删掉文件
# （比如一条举报改了照片，旧照片就该在确认没人用之后清理掉）
def delete_photo_if_unreferenced(engine: Engine, directory: Path, photo_key: str) -> None:
    with engine.connect() as connection:
        referenced = connection.execute(
            select(reports_table.c.id).where(reports_table.c.photo_key == photo_key)
        ).first()
    if referenced is None:
        delete_photo(directory, photo_key)


# hx：清理"孤儿照片"——上传了但 24 小时内一直没被任何举报记录引用的照片文件，
# 防止用户拍了照片却没提交举报，文件一直占着存储空间
def sweep_orphan_photos(engine: Engine, directory: Path) -> None:
    cutoff = datetime.now(timezone.utc) - PHOTO_ORPHAN_TTL
    with engine.connect() as connection:
        referenced = set(connection.execute(select(reports_table.c.photo_key)).scalars().all())
    for metadata_path in directory.glob("*.jpg.meta.json"):
        photo_key = metadata_path.name.removesuffix(".meta.json")
        if photo_key in referenced:
            continue
        metadata_value = read_photo_metadata(directory, photo_key)
        try:
            created_at = datetime.fromisoformat(str((metadata_value or {}).get("createdAt", "")))
        except ValueError:
            created_at = datetime.fromtimestamp(metadata_path.stat().st_mtime, tz=timezone.utc)
        if utc_datetime(created_at) < cutoff:
            delete_photo(directory, photo_key)


# hx：给某张照片单独定一个 24 小时后的清理定时器，时间到了就检查是否还没人引用，
# 没人用就删掉；这样即使 sweep_orphan_photos 没被再次触发，也不会漏掉这张照片
def schedule_orphan_cleanup(engine: Engine, directory: Path, photo_key: str, created_at: datetime) -> threading.Timer:
    delay = max(0.0, (utc_datetime(created_at) + PHOTO_ORPHAN_TTL - datetime.now(timezone.utc)).total_seconds())
    timer = threading.Timer(delay, delete_photo_if_unreferenced, args=(engine, directory, photo_key))
    timer.daemon = True
    timer.start()
    return timer


# hx：把一条举报记录转成返回给前端的 JSON。lat/lng 两个字段故意不放进去——
# 精确坐标不能对外暴露；photoKey 只有记录主人自己能看到（方便签名链接过期后
# 前端拿着这个 key 重新换一个新链接），别人查看这条记录时两者都拿不到，
# 只有当查看者就是这条记录的作者本人时，才额外生成一个短时效的照片预览链接
def report_dict(row: Any, viewer_id: str, jwt_secret: str, directory: Path, beach_names: dict[str, str]) -> dict[str, Any]:
    # Exact coordinates and photo bytes are never copied into this response.
    quantities = quantities_from_row(row)
    value: dict[str, Any] = {
        "id": row.id,
        "beachId": row.beach_id,
        "beachName": beach_names.get(row.beach_id, row.beach_id),
        "quantities": quantities,
        "category": row.category,
        "quantity": row.quantity,
        "categoryScores": {category: round(score, 2) for category, score in category_scores_for(quantities).items()},
        "reportScore": round(report_score_for(quantities), 2),
        "createdAt": contract_timestamp(row.created_at),
        "status": row.status,
        "locationSource": row.location_source,
    }
    if row.status in REPORT_STATUS_NOTES:
        value["statusNote"] = REPORT_STATUS_NOTES[row.status]
    if viewer_id == row.reporter_id:
        # The opaque key is returned only to the owner so an expired preview can be renewed.
        value["photoKey"] = row.photo_key
        photo_url = signed_photo_url(row.photo_key, row.reporter_id, jwt_secret, directory)
        if photo_url:
            value["photoUrl"] = photo_url
    return value


# hx：小工具，把 (状态码, 错误码, 错误信息) 打包成一个元组，方便下面的校验函数
# 在各个 return 语句里统一格式
def report_problem(status: int, code: str, message: str) -> tuple[int, str, str]:
    return status, code, message


# hx：举报提交/修改的核心校验逻辑，按顺序检查：字段名不能有多余的、必须带照片、
# 品类和数量档必须是已知枚举值、海滩必须存在、locationSource 只能是 gps 或 manual、
# gps 来源必须带经纬度且要在合法范围内（存的时候只留 3 位小数）、manual 来源不能带坐标、
# 照片必须是当前用户自己上传过的。全部通过才返回整理好的数据
def validate_report_payload(
    payload: Any,
    beaches: list[dict[str, Any]],
    owner_id: str,
    directory: Path,
    require_uploaded_photo: bool,
) -> tuple[dict[str, Any] | None, tuple[int, str, str] | None]:
    if not isinstance(payload, dict):
        return None, report_problem(400, "VALIDATION_FAILED", "A JSON object is required.")
    if set(payload) - REPORT_INPUT_FIELDS:
        return None, report_problem(400, "VALIDATION_FAILED", "The report contains unsupported fields.")

    photo_key = str(payload.get("photoKey") or "").strip()
    if not photo_key:
        return None, report_problem(400, "PHOTO_REQUIRED", "A photo is required.")

    quantities = payload.get("quantities")
    if (
        not isinstance(quantities, dict)
        or not quantities
        or any(category not in CATEGORY_WEIGHTS or quantity not in QUANTITY_WEIGHTS for category, quantity in quantities.items())
    ):
        return None, report_problem(400, "VALIDATION_FAILED", "Choose at least one valid category and quantity band.")

    beach_id = str(payload.get("beachId") or "").strip()
    beach = next((item for item in beaches if item["id"] == beach_id), None)
    if beach is None:
        return None, report_problem(404, "NOT_FOUND", "Beach not found.")

    location_source = payload.get("locationSource")
    if location_source not in {"gps", "manual"}:
        return None, report_problem(400, "VALIDATION_FAILED", "locationSource must be gps or manual.")

    lat = lng = None
    coords = payload.get("coords")
    if location_source == "gps":
        if not isinstance(coords, dict) or set(coords) != {"lat", "lng"}:
            return None, report_problem(400, "VALIDATION_FAILED", "GPS reports require lat and lng.")
        try:
            raw_lat, raw_lng = float(coords["lat"]), float(coords["lng"])
        except (TypeError, ValueError):
            return None, report_problem(400, "VALIDATION_FAILED", "lat and lng must be numbers.")
        if not math.isfinite(raw_lat) or not math.isfinite(raw_lng) or not -90 <= raw_lat <= 90 or not -180 <= raw_lng <= 180:
            return None, report_problem(400, "VALIDATION_FAILED", "lat or lng is outside its valid range.")
        lat, lng = round(raw_lat, 3), round(raw_lng, 3)
    elif coords is not None:
        return None, report_problem(400, "VALIDATION_FAILED", "Manual reports must not include coordinates.")

    photo_metadata = read_photo_metadata(directory, photo_key)
    if require_uploaded_photo and (photo_metadata is None or photo_metadata.get("ownerId") != owner_id):
        return None, report_problem(404, "NOT_FOUND", "Photo not found.")

    category, quantity = derive_category_quantity(quantities)
    return {
        "beach": beach,
        "quantities": quantities,
        "category": category,
        "quantity": quantity,
        "photo_key": photo_key,
        "photo_mime": (photo_metadata or {}).get("mime"),
        "photo_stripped": (photo_metadata or {}).get("metadataStripped"),
        "location_source": location_source,
        "lat": lat,
        "lng": lng,
    }, None


# hx：查重规则的唯一实现——同一个举报人在同一个海滩、同一个吉隆坡日期，
# 已经有一条 Counted 记录了，这条新的就判定成 Duplicate，不比较坐标距离；
# 改举报时会传 exclude_report_id 排除自己，不然自己跟自己比永远都是重复
def duplicate_status(
    connection: Any,
    reporter_id: str,
    beach_id: str,
    created_at: datetime,
    exclude_report_id: str | None = None,
) -> str:
    query = select(reports_table.c.id, reports_table.c.created_at).where(
        reports_table.c.reporter_id == reporter_id,
        reports_table.c.beach_id == beach_id,
        reports_table.c.status == "Counted",
    )
    rows = connection.execute(query).all()
    local_day = utc_datetime(created_at).astimezone(KUALA_LUMPUR).date()
    for row in rows:
        if row.id != exclude_report_id and utc_datetime(row.created_at).astimezone(KUALA_LUMPUR).date() == local_day:
            return "Duplicate"
    return "Counted"


# hx：整个 Flask app 的工厂函数。启动时：拿到 JWT 密钥、建好数据库和照片目录、
# 加载四个海滩的种子数据、先清理一遍孤儿照片，再给启动时已经存在但还没到期的
# 照片重新挂上定时清理器（防止服务重启导致清理任务丢失）
def create_app(
    database_url: str | None = None,
    testing: bool = False,
    photo_storage_dir: str | Path | None = None,
) -> Flask:
    jwt_secret = auth_jwt_secret(testing)
    application = Flask(__name__)
    application.config.update(TESTING=testing, MAX_CONTENT_LENGTH=12 * 1024 * 1024)
    CORS(application, resources={r"/*": {"origins": os.getenv("FRONTEND_ORIGINS", "*").split(",")}})

    engine = create_engine_for_url(normalise_database_url(database_url or os.getenv("DATABASE_URL")))
    initialise_database(engine)
    directory = photo_storage_path(photo_storage_dir)
    beaches = load_beaches(engine)
    beach_names = {beach["id"]: beach["name"] for beach in beaches}
    application.extensions["marine_engine"] = engine
    application.extensions["photo_storage_dir"] = directory
    application.extensions["photo_cleanup_timers"] = []
    sweep_orphan_photos(engine, directory)
    for metadata_path in directory.glob("*.jpg.meta.json"):
        photo_key = metadata_path.name.removesuffix(".meta.json")
        metadata_value = read_photo_metadata(directory, photo_key)
        try:
            created_at = datetime.fromisoformat(str((metadata_value or {}).get("createdAt", "")))
        except ValueError:
            created_at = datetime.fromtimestamp(metadata_path.stat().st_mtime, tz=timezone.utc)
        application.extensions["photo_cleanup_timers"].append(
            schedule_orphan_cleanup(engine, directory, photo_key, created_at)
        )
    # hx：记录每个用户在每个限流分类下的请求时间戳，用来做简单的滑动窗口限流
    rate_events: defaultdict[tuple[str, str], deque[float]] = defaultdict(deque)

    # hx：需要登录的接口套上这个装饰器——校验 Authorization: Bearer <token>，
    # 通过了就把当前用户挂到 request.current_user 上，后面的视图函数直接用
    def require_auth(view: Callable[..., Any]):
        @wraps(view)
        def wrapper(*args: Any, **kwargs: Any):
            header = request.headers.get("Authorization", "")
            token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
            user_id = decode_token_subject(token, jwt_secret) if token else None
            if user_id is None:
                return error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
            with engine.connect() as connection:
                row = connection.execute(select(users_table).where(users_table.c.id == user_id)).first()
            if row is None:
                return error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
            request.current_user = row
            return view(*args, **kwargs)

        return wrapper

    # hx：按用户 + 限流分类算一个每小时的请求次数上限（举报 30/小时、
    # 上传照片 60/小时），用滑动窗口——每次请求先把一小时之前的记录扔掉，
    # 剩下的数量超过上限就拒绝，没超就记一笔放行
    def rate_limited(bucket: str, limit: int):
        def decorator(view: Callable[..., Any]):
            @wraps(view)
            def wrapper(*args: Any, **kwargs: Any):
                now = time.monotonic()
                events = rate_events[(bucket, request.current_user.id)]
                while events and events[0] <= now - 3600:
                    events.popleft()
                if len(events) >= limit:
                    return error_response(429, "RATE_LIMITED", "Too many requests. Please try again later.")
                events.append(now)
                return view(*args, **kwargs)

            return wrapper

        return decorator

    # hx：以下三个是全局错误处理器，保证任何报错都按契约里统一的
    # {code, message} 格式返回，而不是 Flask 默认的 HTML 错误页
    @application.errorhandler(RequestEntityTooLarge)
    def payload_too_large(_error: RequestEntityTooLarge):
        return error_response(413, "PAYLOAD_TOO_LARGE", "The upload payload is too large.")

    @application.errorhandler(404)
    def route_not_found(_error: Any):
        return error_response(404, "NOT_FOUND", "The requested resource was not found.")

    # hx：兜底错误处理——测试环境下让异常直接抛出来（方便定位问题），
    # 正式环境下把 Flask/Werkzeug 的 HTTP 异常转成契约格式，
    # 其他没预料到的异常记日志后统一返回 500 INTERNAL_ERROR，不把具体报错细节泄露给用户
    @application.errorhandler(Exception)
    def contract_error(error: Exception):
        if application.testing and not isinstance(error, HTTPException):
            raise error
        if isinstance(error, HTTPException):
            status = error.code or 500
            code = "VALIDATION_FAILED" if status < 500 else "INTERNAL_ERROR"
            return error_response(status, code, error.description or "The request could not be completed.")
        application.logger.exception("Unhandled API error", exc_info=error)
        return error_response(500, "INTERNAL_ERROR", "Something went wrong. Please try again later.")

    # hx：根路径，简单返回项目信息，主要给人手动看
    @application.get("/")
    def root():
        return jsonify({"project": "Radar Sampah", "status": "ready", "apiVersion": "1.0.0"})

    # hx：健康检查接口，部署平台靠这个判断服务是不是活着
    @application.get("/health")
    def health():
        return jsonify({"status": "ok", "database": "configured"})

    # hx：领一个新的匿名编号——随机分配 4 位数字 + 建用户记录，签发 30 天有效期的 token
    @application.post("/auth/anonymous")
    def create_anonymous_participant():
        with engine.begin() as connection:
            try:
                participant_id = generate_participant_id(connection)
            except RuntimeError as error:
                return error_response(500, "INTERNAL_ERROR", str(error))
            user_id = "u_" + secrets.token_hex(12)
            now = datetime.now(timezone.utc)
            connection.execute(
                insert(users_table).values(
                    id=user_id,
                    participant_id=participant_id,
                    role=DEFAULT_VOLUNTEER_ROLE,
                    created_at=now,
                )
            )
        return jsonify({"token": issue_token(user_id, jwt_secret), "user": {"id": user_id, "participantId": participant_id, "role": DEFAULT_VOLUNTEER_ROLE}}), 201

    # hx：用已有的 4 位编号找回账号；格式不对或查无此人统一返回 404
    # UNKNOWN_PARTICIPANT（不是 401，因为这不是"没登录"而是"这个编号不存在"）
    @application.post("/auth/restore")
    def restore_anonymous_participant():
        payload = request.get_json(silent=True)
        participant_id = str(payload.get("participantId") or "").strip() if isinstance(payload, dict) else ""
        if not re.fullmatch(r"\d{4}", participant_id):
            return error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        with engine.connect() as connection:
            row = connection.execute(select(users_table).where(users_table.c.participant_id == participant_id)).first()
        if row is None:
            return error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        return jsonify({"token": issue_token(row.id, jwt_secret), "user": user_dict(row)})

    # hx：登出，token 是无状态的 JWT，服务端不用存 session，直接 204 让前端清本地 token
    @application.post("/auth/logout")
    @require_auth
    def logout_anonymous_participant():
        return "", 204

    # hx：前端进页面时用这个接口问"我是谁"
    @application.get("/auth/me")
    @require_auth
    def get_current_participant():
        return jsonify(user_dict(request.current_user))

    # hx：返回所有海滩的汇总信息（地图/列表用），不需要登录就能看
    @application.get("/beaches")
    def get_beaches():
        now = datetime.now(timezone.utc)
        return jsonify([beach_summary(engine, beach, now) for beach in beaches])

    # hx：单个海滩的详情，在汇总信息基础上多了 species/ecologicalNote（科普内容）
    # 和 composition（构成占比）。composition 取的是这个海滩"最新一条 Counted 记录"
    # 里的品类构成，不是 90 天窗口内的聚合——跟 severity 的计算逻辑不是一回事
    @application.get("/beaches/<beach_id>")
    def get_beach(beach_id: str):
        beach = next((item for item in beaches if item["id"] == beach_id), None)
        if beach is None:
            return error_response(404, "NOT_FOUND", "Beach not found.")
        detail = beach_summary(engine, beach)
        detail.update({"species": beach.get("species", []), "ecologicalNote": beach.get("ecologicalNote", "")})
        with engine.connect() as connection:
            row = connection.execute(
                select(reports_table)
                .where(
                    reports_table.c.beach_id == beach_id,
                    reports_table.c.status == "Counted",
                )
                .order_by(reports_table.c.created_at.desc())
            ).first()
        if row is None:
            detail.update({"composition": None, "compositionSource": None})
        else:
            quantities = quantities_from_row(row)
            detail.update(
                {
                    "composition": [
                        {"category": category, "quantity": quantities[category]}
                        for category in FRONTEND_CATEGORIES
                        if category in quantities
                    ],
                    "compositionSource": {"reportId": row.id, "createdAt": contract_timestamp(row.created_at)},
                }
            )
        return jsonify(detail)

    # hx：把后端实际用来算 severity 的权重/阈值/聚合方式发布出去，前端"How it's
    # rated"页面直接读这份数据展示给用户，保证两边用的是同一套规则，不会各说各的
    @application.get("/scoring-method")
    def get_scoring_method():
        return jsonify(
            {
                "categoryWeights": [{"category": category, "weight": CATEGORY_WEIGHTS[category]} for category in FRONTEND_CATEGORIES],
                "quantityWeights": [{"quantity": quantity, "weight": weight} for quantity, weight in QUANTITY_WEIGHTS.items()],
                "bands": list(SCORING_BANDS),
                "windowDays": 90,
                "minReports": 3,
                "reportAggregation": "max",
                "beachAggregation": "median",
                "ruleVersion": "radar-sampah-scoring-v2",
            }
        )

    # hx：GPS 定位一次性转成"最近的海滩"，坐标本身完全不落库，
    # 用完这一次请求就丢掉；用半正矢公式算球面距离，超过 25 公里就当作没匹配到，
    # 返回 null 让前端转去手动选海滩
    @application.post("/geo/resolve-beach")
    @require_auth
    def resolve_beach():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {"lat", "lng"}:
            return error_response(400, "VALIDATION_FAILED", "lat and lng are required.")
        try:
            lat, lng = float(payload["lat"]), float(payload["lng"])
        except (TypeError, ValueError):
            return error_response(400, "VALIDATION_FAILED", "lat and lng must be numbers.")
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            return error_response(400, "VALIDATION_FAILED", "lat or lng is outside its valid range.")
        nearest: dict[str, Any] | None = None
        nearest_distance = float("inf")
        for beach in beaches:
            phi1, phi2 = math.radians(lat), math.radians(beach["lat"])
            dphi = math.radians(beach["lat"] - lat)
            dlambda = math.radians(beach["lng"] - lng)
            haversine = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            distance = 6371 * 2 * math.asin(math.sqrt(haversine))
            if distance < nearest_distance:
                nearest, nearest_distance = beach, distance
        return jsonify(beach_summary(engine, nearest)) if nearest is not None and nearest_distance <= 25 else jsonify(None)

    # hx：上传照片——校验格式（JPEG/PNG/HEIC）和大小（≤10MB），
    # 处理完（压缩+剥 EXIF）存到私有目录，文件名用随机字符串（不能是递归编号或
    # 带参与者编号/海滩名/日期，防止被猜出规律），最后返回 photoKey 和一个
    # 短时效预览链接给前端确认用；每小时限 60 次
    @application.post("/uploads/photos")
    @require_auth
    @rate_limited("photo-upload", 60)
    def upload_photo():
        photo = request.files.get("photo")
        if photo is None or not photo.filename:
            return error_response(400, "PHOTO_REQUIRED", "A photo is required.")
        mime = (photo.mimetype or "").lower().split(";", 1)[0]
        if mime not in PHOTO_MIME_TYPES:
            return error_response(400, "PHOTO_UNSUPPORTED_TYPE", "Only JPEG, PNG, or HEIC photos are accepted.")
        raw = photo.read(PHOTO_MAX_BYTES + 1)
        if len(raw) > PHOTO_MAX_BYTES:
            return error_response(400, "PHOTO_TOO_LARGE", "Photo exceeds the 10 MB limit.")
        try:
            processed = process_photo(raw)
        except ValueError as error:
            return error_response(400, "VALIDATION_FAILED", str(error))
        sweep_orphan_photos(engine, directory)
        photo_key = secrets.token_hex(16) + ".jpg"
        path = photo_file_path(directory, photo_key)
        assert path is not None
        path.write_bytes(processed)
        write_photo_metadata(
            directory,
            photo_key,
            {
                "ownerId": request.current_user.id,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "mime": "image/jpeg",
                "metadataStripped": True,
            },
        )
        application.extensions["photo_cleanup_timers"].append(
            schedule_orphan_cleanup(engine, directory, photo_key, datetime.now(timezone.utc))
        )
        preview_url = signed_photo_url(photo_key, request.current_user.id, jwt_secret, directory)
        return jsonify({"photoKey": photo_key, "previewUrl": preview_url, "metadataStripped": True}), 201

    # hx：签名链接只有 15 分钟有效期，过期了前端可以调这个接口重新换一个新的——
    # 同样要校验调用者就是这张照片的主人才给换，不然返回"照片不存在"
    @application.get("/uploads/photos/<photo_key>/preview-url")
    @require_auth
    def renew_photo_preview_url(photo_key: str):
        metadata_value = read_photo_metadata(directory, photo_key)
        path = photo_file_path(directory, photo_key)
        if metadata_value is None or metadata_value.get("ownerId") != request.current_user.id or path is None or not path.is_file():
            return error_response(404, "NOT_FOUND", "Photo not found.")
        preview_url = signed_photo_url(photo_key, request.current_user.id, jwt_secret, directory)
        if not preview_url:
            return error_response(404, "NOT_FOUND", "Photo not found.")
        return jsonify({"previewUrl": preview_url})

    # hx：通过带 token 的签名链接查看照片本身（img 标签发不出 Authorization 头，
    # 所以鉴权信息放在 URL 的 token 参数里）；校验 token 有效、用途对、
    # 指向的照片没变，还要确认真的是照片主人签发的才给看，其它一律当作照片不存在
    @application.get("/uploads/photos/<photo_key>")
    def view_signed_photo(photo_key: str):
        token = request.args.get("token", "")
        try:
            claims = jwt.decode(token, jwt_secret, algorithms=[AUTH_JWT_ALGORITHM])
        except jwt.PyJWTError:
            return error_response(401, "UNAUTHENTICATED", "This photo link is invalid or has expired.")
        if claims.get("purpose") != "photo-preview" or claims.get("photoKey") != photo_key:
            return error_response(401, "UNAUTHENTICATED", "This photo link is invalid or has expired.")
        metadata_value = read_photo_metadata(directory, photo_key)
        path = photo_file_path(directory, photo_key)
        if metadata_value is None or metadata_value.get("ownerId") != claims.get("sub") or path is None or not path.is_file():
            return error_response(404, "NOT_FOUND", "Photo not found.")
        return send_file(path, mimetype="image/jpeg", max_age=0, conditional=True)

    # hx：提交一条举报——核心接口，校验通过后同步判定 Counted/Duplicate，
    # 存进数据库，立刻把结果返回（不是先存成"待审核"再等人工处理）；每小时限 30 次
    @application.post("/reports")
    @require_auth
    @rate_limited("report-create", 30)
    def create_report():
        data, problem = validate_report_payload(request.get_json(silent=True), beaches, request.current_user.id, directory, True)
        if problem:
            return error_response(*problem)
        assert data is not None
        now = datetime.now(timezone.utc)
        report_id = "r_" + secrets.token_hex(10)
        with engine.begin() as connection:
            status = duplicate_status(connection, request.current_user.id, data["beach"]["id"], now)
            connection.execute(
                insert(reports_table).values(
                    id=report_id,
                    reporter_id=request.current_user.id,
                    beach_id=data["beach"]["id"],
                    beach_name=data["beach"]["name"],
                    quantities=json.dumps(data["quantities"], separators=(",", ":")),
                    category=data["category"],
                    quantity=data["quantity"],
                    photo_key=data["photo_key"],
                    photo_mime=data["photo_mime"] or "image/jpeg",
                    photo_stripped=bool(data["photo_stripped"]),
                    location_source=data["location_source"],
                    lat=data["lat"],
                    lng=data["lng"],
                    status=status,
                    created_at=now,
                    updated_at=now,
                    **quantity_values(data["quantities"]),
                )
            )
            row = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        return jsonify(report_dict(row, request.current_user.id, jwt_secret, directory, beach_names)), 201

    # hx：返回当前用户自己的举报记录，可以按 status 筛选，按时间倒序
    @application.get("/reports/mine")
    @require_auth
    def get_my_reports():
        status = request.args.get("status")
        if status is not None and status not in REPORT_STATUSES:
            return error_response(400, "VALIDATION_FAILED", "status is not valid.")
        query = (
            select(reports_table)
            .where(reports_table.c.reporter_id == request.current_user.id)
            .order_by(reports_table.c.created_at.desc())
        )
        if status:
            query = query.where(reports_table.c.status == status)
        with engine.connect() as connection:
            rows = connection.execute(query).all()
        return jsonify([report_dict(row, request.current_user.id, jwt_secret, directory, beach_names) for row in rows])

    # hx：当前用户自己的三个状态各有多少条记录，"我的记录"页面的统计数字
    @application.get("/reports/mine/counts")
    @require_auth
    def get_my_report_counts():
        with engine.connect() as connection:
            statuses = connection.execute(
                select(reports_table.c.status).where(reports_table.c.reporter_id == request.current_user.id)
            ).scalars().all()
        return jsonify(
            {
                "counted": statuses.count("Counted"),
                "duplicate": statuses.count("Duplicate"),
                "incomplete": statuses.count("Incomplete"),
            }
        )

    # hx：修正自己的举报——只能改自己的记录（403 NOT_OWNER），把没传的字段
    # 沿用旧值、合并成完整的请求体后重新走一遍校验；换照片时要重新走过一次
    # "必须是自己上传过的照片"检查；改完要按新数据重新判定一次 Counted/Duplicate
    # （比如把 Incomplete 的记录补好照片后应该能变回 Counted），旧照片如果换掉了
    # 且没别的记录引用就顺手删掉
    @application.patch("/reports/<report_id>")
    @require_auth
    def update_report(report_id: str):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not payload or set(payload) - REPORT_INPUT_FIELDS:
            return error_response(400, "VALIDATION_FAILED", "Send at least one supported report field.")
        with engine.connect() as connection:
            old = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        if old is None:
            return error_response(404, "NOT_FOUND", "Report not found.")
        if old.reporter_id != request.current_user.id:
            return error_response(403, "NOT_OWNER", "You can only correct your own report.")

        if "locationSource" in payload or "coords" in payload:
            location_source = payload.get("locationSource", old.location_source)
            coords = payload.get("coords")
        else:
            location_source = old.location_source
            coords = {"lat": old.lat, "lng": old.lng} if old.location_source == "gps" else None
        merged = {
            "beachId": payload.get("beachId", old.beach_id),
            "quantities": payload.get("quantities", quantities_from_row(old)),
            "photoKey": payload.get("photoKey", old.photo_key),
            "locationSource": location_source,
        }
        if coords is not None:
            merged["coords"] = coords
        require_uploaded_photo = "photoKey" in payload and payload["photoKey"] != old.photo_key
        data, problem = validate_report_payload(merged, beaches, request.current_user.id, directory, require_uploaded_photo)
        if problem:
            return error_response(*problem)
        assert data is not None
        created_at = utc_datetime(old.created_at)
        now = datetime.now(timezone.utc)
        with engine.begin() as connection:
            status = duplicate_status(
                connection,
                request.current_user.id,
                data["beach"]["id"],
                created_at,
                exclude_report_id=report_id,
            )
            connection.execute(
                reports_table.update()
                .where(reports_table.c.id == report_id)
                .values(
                    beach_id=data["beach"]["id"],
                    beach_name=data["beach"]["name"],
                    quantities=json.dumps(data["quantities"], separators=(",", ":")),
                    category=data["category"],
                    quantity=data["quantity"],
                    photo_key=data["photo_key"],
                    photo_mime=data["photo_mime"] or old.photo_mime,
                    photo_stripped=bool(data["photo_stripped"]) if data["photo_stripped"] is not None else old.photo_stripped,
                    location_source=data["location_source"],
                    lat=data["lat"],
                    lng=data["lng"],
                    status=status,
                    updated_at=now,
                    **quantity_values(data["quantities"]),
                )
            )
            row = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        if old.photo_key != data["photo_key"]:
            delete_photo_if_unreferenced(engine, directory, old.photo_key)
        return jsonify(report_dict(row, request.current_user.id, jwt_secret, directory, beach_names))

    return application


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
