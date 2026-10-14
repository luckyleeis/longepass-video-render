import os
import sys

from agent.cli import main

try:
    sys.exit(main())
except (FileNotFoundError, FileExistsError, ValueError, RuntimeError, OSError) as e:
    # 사람이 읽을 오류 한 줄 (자세한 추적은 LP_DEBUG=1)
    if os.getenv("LP_DEBUG"):
        raise
    print(f"오류: {e}", file=sys.stderr)
    sys.exit(1)
