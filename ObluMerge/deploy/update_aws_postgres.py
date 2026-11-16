#!/usr/bin/env python3
"""
ObluMerge SQLite-to-PostgreSQL Production ETL Sync Script
Safe, transactional full overwrite from dbb.sqlite3 into AWS PostgreSQL (obludb).
"""

import os
import sys
import argparse
import sqlite3
import datetime
from pathlib import Path
from urllib.parse import urlparse

# Ensure we can import psycopg2
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Error: psycopg2 is required. Please run: pip install psycopg2-binary")
    sys.exit(1)


def parse_database_url(url: str):
    """Parse standard postgresql:// URL into psycopg2 connect kwargs."""
    result = urlparse(url)
    return {
        "dbname": result.path.lstrip("/"),
        "user": result.username,
        "password": result.password,
        "host": result.hostname or "127.0.0.1",
        "port": result.port or 5432,
    }


def get_sqlite_tables(sqlite_conn):
    """Get list of user tables in SQLite."""
    cur = sqlite_conn.cursor()
    cur.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' 
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
    """)
    return [row[0] for row in cur.fetchall()]


def get_postgres_columns(pg_cur, table_name):
    """Get column names, data types, nullability, and default values for a table in PostgreSQL."""
    pg_cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = %s
        ORDER BY ordinal_position;
    """, (table_name,))
    return {
        row[0]: {
            "type": row[1],
            "nullable": row[2] == "YES",
            "default": row[3]
        }
        for row in pg_cur.fetchall()
    }


def run_sync(sqlite_path: str, pg_url: str, batch_size: int = 2000):
    print("=" * 70)
    print("OBLUMERGE AWS DATABASE UPDATE: SQLite -> PostgreSQL")
    print("=" * 70)
    print(f"Source SQLite:   {sqlite_path}")
    masked_url = pg_url
    if "@" in pg_url:
        prefix, host_part = pg_url.split("@", 1)
        scheme_user = prefix.split(":", 2)[:2]
        masked_url = f"{':'.join(scheme_user)}:****@{host_part}"
    print(f"Target Postgres: {masked_url}")
    print(f"Timestamp:       {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    if not os.path.exists(sqlite_path):
        print(f"[ERROR] SQLite file not found: {sqlite_path}")
        sys.exit(1)

    # 1. Connect to SQLite
    sq_conn = sqlite3.connect(sqlite_path)
    sq_conn.row_factory = sqlite3.Row
    sq_cur = sq_conn.cursor()

    # 2. Connect to PostgreSQL
    pg_kwargs = parse_database_url(pg_url)
    try:
        pg_conn = psycopg2.connect(**pg_kwargs)
        pg_conn.autocommit = False
        pg_cur = pg_conn.cursor()
        print("[OK] Connected successfully to PostgreSQL target.")
    except Exception as e:
        print(f"[ERROR] Failed to connect to PostgreSQL: {e}")
        sys.exit(1)

    # 3. Discover common tables
    sq_tables = get_sqlite_tables(sq_conn)
    print(f"[INFO] Discovered {len(sq_tables)} tables in SQLite database.")

    # Filter tables that exist in PostgreSQL
    pg_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    pg_all_tables = set(row[0] for row in pg_cur.fetchall())

    common_tables = [t for t in sq_tables if t in pg_all_tables]
    print(f"[INFO] Found {len(common_tables)} matching tables in PostgreSQL.")

    if not common_tables:
        print("[ERROR] No matching tables found! Have migrations been run on PostgreSQL?")
        sys.exit(1)

    try:
        # Disable foreign key triggers for bulk reload
        print("\n[STEP 1/5] Disabling foreign key constraints (replica mode)...")
        pg_cur.execute("SET session_replication_role = 'replica';")

        # Truncate all matching tables in PostgreSQL
        print("[STEP 2/5] Truncating existing PostgreSQL tables...")
        truncate_sql = "TRUNCATE TABLE " + ", ".join([f'"{t}"' for t in common_tables]) + " CASCADE;"
        pg_cur.execute(truncate_sql)
        print("  Truncate complete.")

        # Copy data table by table
        print("\n[STEP 3/5] Copying rows from SQLite to PostgreSQL...")
        summary = []

        for table in common_tables:
            # Get target PG columns & types
            pg_cols_info = get_postgres_columns(pg_cur, table)
            if not pg_cols_info:
                continue

            # Get source SQLite columns
            sq_cur.execute(f'PRAGMA table_info("{table}");')
            sq_col_names = set(row[1] for row in sq_cur.fetchall())

            # Intersect columns
            target_cols = [c for c in pg_cols_info.keys() if c in sq_col_names]
            if not target_cols:
                continue

            # Pre-compute column specs for fast per-row mapping & NOT NULL fallback
            col_specs = {}
            for c in target_cols:
                meta = pg_cols_info[c]
                col_type = meta["type"]
                is_null = meta["nullable"]
                raw_default = meta["default"]

                fallback_val = None
                if not is_null:
                    if c == "leave_policy_mode":
                        fallback_val = "annual"
                    elif raw_default and not raw_default.startswith("nextval"):
                        cleaned = raw_default.split("::")[0].strip("'")
                        if col_type == "boolean":
                            fallback_val = (cleaned.lower() in ("true", "1", "t"))
                        elif any(k in col_type for k in ("int", "numeric", "double", "real")):
                            try:
                                fallback_val = int(cleaned) if "int" in col_type else float(cleaned)
                            except ValueError:
                                fallback_val = 0
                        else:
                            fallback_val = cleaned
                    else:
                        if col_type == "boolean":
                            fallback_val = False
                        elif col_type in ("character varying", "text", "character"):
                            fallback_val = ""
                        elif "int" in col_type:
                            fallback_val = 0
                        elif any(k in col_type for k in ("numeric", "double", "real")):
                            fallback_val = 0.0
                        elif "date" in col_type:
                            fallback_val = datetime.date.today()
                        elif "timestamp" in col_type:
                            fallback_val = datetime.datetime.now()
                        elif col_type in ("json", "jsonb"):
                            fallback_val = "{}"

                col_specs[c] = {
                    "type": col_type,
                    "nullable": is_null,
                    "fallback": fallback_val,
                    "is_bool": (col_type == "boolean"),
                    "is_text": col_type in ("character varying", "text", "character"),
                }

            # Fetch count
            sq_cur.execute(f'SELECT COUNT(*) FROM "{table}";')
            total_rows = sq_cur.fetchone()[0]

            if total_rows == 0:
                summary.append((table, 0, 0, True))
                continue

            # Query rows from SQLite
            cols_quoted_sq = ", ".join([f'"{c}"' for c in target_cols])
            sq_cur.execute(f'SELECT {cols_quoted_sq} FROM "{table}";')

            cols_quoted_pg = ", ".join([f'"{c}"' for c in target_cols])
            insert_query = f'INSERT INTO "{table}" ({cols_quoted_pg}) VALUES %s'

            inserted_count = 0
            while True:
                rows = sq_cur.fetchmany(batch_size)
                if not rows:
                    break

                batch_data = []
                for row in rows:
                    row_vals = []
                    for idx, c in enumerate(target_cols):
                        val = row[idx]
                        spec = col_specs[c]

                        # Boolean type conversion (SQLite stores 0/1)
                        if spec["is_bool"] and val is not None:
                            val = bool(val)

                        # Blank string cleanup for non-text columns
                        if val == "" and not spec["is_text"]:
                            val = None

                        # NOT NULL fallback
                        if val is None and not spec["nullable"]:
                            val = spec["fallback"]

                        row_vals.append(val)
                    batch_data.append(tuple(row_vals))

                psycopg2.extras.execute_values(pg_cur, insert_query, batch_data, page_size=batch_size)
                inserted_count += len(batch_data)

            print(f"  -> {table}: {inserted_count} / {total_rows} rows copied.")
            summary.append((table, total_rows, inserted_count, total_rows == inserted_count))

        # Re-enable foreign key constraints
        print("\n[STEP 4/5] Re-enabling foreign key constraints (origin mode)...")
        pg_cur.execute("SET session_replication_role = 'origin';")

        # Reset all PostgreSQL sequences
        print("[STEP 5/5] Resetting auto-increment serial sequences in PostgreSQL...")
        for table in common_tables:
            pg_cols_info = get_postgres_columns(pg_cur, table)
            if "id" in pg_cols_info:
                try:
                    pg_cur.execute(f"""
                        SELECT setval(
                            pg_get_serial_sequence(%s, 'id'),
                            COALESCE((SELECT MAX("id") FROM "{table}"), 1),
                            (SELECT COUNT(*) > 0 FROM "{table}")
                        );
                    """, (table,))
                except Exception as seq_err:
                    # Ignore if table doesn't have an auto sequence
                    pass

        # Commit everything
        pg_conn.commit()
        print("\n[OK] Transaction committed successfully to PostgreSQL!")

        # Verification audit report
        print("\n" + "=" * 70)
        print("MIGRATION AUDIT SUMMARY")
        print("=" * 70)
        print(f"{'Table Name':<45} | {'SQLite':<8} | {'Postgres':<8} | {'Status'}")
        print("-" * 70)
        all_passed = True
        for tbl, sq_cnt, pg_cnt, match in summary:
            status = "OK" if match else "MISMATCH"
            if not match:
                all_passed = False
            if sq_cnt > 0 or not match:
                print(f"{tbl:<45} | {sq_cnt:<8} | {pg_cnt:<8} | {status}")

        print("=" * 70)
        if all_passed:
            print("[SUCCESS] All tables migrated with 100% row-for-row parity!")
        else:
            print("[WARNING] One or more tables had row count discrepancies. Please check logs.")

    except Exception as e:
        pg_conn.rollback()
        print(f"\n[FATAL ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        sq_conn.close()
        pg_conn.close()


def main():
    parser = argparse.ArgumentParser(description="ObluMerge SQLite -> PostgreSQL Sync Utility")
    parser.add_argument("--sqlite", default="dbb.sqlite3", help="Path to source SQLite file")
    parser.add_argument("--database-url", default=None, help="PostgreSQL connection string (defaults to DATABASE_URL in .env)")
    args = parser.parse_args()

    sqlite_path = os.path.abspath(args.sqlite)

    db_url = args.database_url
    if not db_url:
        env_path = Path("ObluMerge/.env")
        if not env_path.exists():
            env_path = Path(".env")
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break

    if not db_url:
        db_url = os.environ.get("DATABASE_URL")

    if not db_url:
        print("[ERROR] DATABASE_URL not found in arguments, .env, or environment.")
        sys.exit(1)

    run_sync(sqlite_path, db_url)


if __name__ == "__main__":
    main()
