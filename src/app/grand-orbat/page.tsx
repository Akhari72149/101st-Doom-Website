"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { supabase } from "@/lib/supabase";
import { buildTree } from "@/utils/buildTree";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useRouter } from "next/navigation";

/* ===================================================== */
/* TYPES */
/* ===================================================== */

type Rank = {
  id: string;
  name: string;
  rank_level: number;
};

type Personnel = {
  id: string;
  name: string;
  slotted_position: string | null;
  ranks?: Rank | null;
};

type OrgRole = {
  role: string;
  slotId?: string | null;
  discordRoleIds?: string[];
};

type OrgNode = {
  id: string;
  name: string;
  roles?: OrgRole[];
  children?: OrgNode[];
};

type RoleGroup = {
  role: string;
  slots: OrgRole[];
};

/* ===================================================== */
/* MAIN COMPONENT */
/* ===================================================== */

export default function GrandOrbat() {
  const router = useRouter();
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

  const transformRef = useRef<any>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  /* ===================================================== */
  /* FETCH DATA */
  /* ===================================================== */

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("org_nodes")
        .select("*")
        .order("order_index", { ascending: true });

      const tree = buildTree((data || []) as any[]) as OrgNode[];
      setOrgTree(tree);

      const map: Record<string, boolean> = {};

      const expand = (nodes: OrgNode[]) => {
        nodes.forEach((node) => {
          map[node.id] = true;
          if (node.children?.length) expand(node.children);
        });
      };

      expand(tree);
      setOpenNodes(map);

      const { data: personnelData } = await supabase
        .from("personnel")
        .select("id, name, slotted_position, ranks(*)");

      const normalizedPersonnel: Personnel[] = (personnelData || []).map(
        (person: any) => ({
          id: person.id,
          name: person.name,
          slotted_position: person.slotted_position,
          ranks: Array.isArray(person.ranks)
            ? person.ranks[0] || null
            : person.ranks || null,
        })
      );

      setPersonnel(normalizedPersonnel);
    }

    fetchData();
  }, []);

  /* ===================================================== */
  /* MANUAL POSITION + SCALE ON LOAD */
  /* ===================================================== */

  useEffect(() => {
    if (!transformRef.current) return;

    const timer = setTimeout(() => {
      transformRef.current.setTransform(-200, 100, 0.3, 800);
    }, 300);

    return () => clearTimeout(timer);
  }, [orgTree]);

  /* ===================================================== */
  /* SLOT MAP */
  /* ===================================================== */

  const slotMap = useMemo(() => {
    const map: Record<string, Personnel> = {};

    personnel.forEach((person) => {
      if (!person.slotted_position) return;
      map[person.slotted_position.toLowerCase()] = person;
    });

    return map;
  }, [personnel]);

  /* ===================================================== */
  /* TREE FILTER */
  /* ===================================================== */

  const filteredTree = useMemo(() => {
    if (!search.trim()) return orgTree;

    const filter = (nodes: OrgNode[]): OrgNode[] =>
      nodes
        .map((node) => {
          const children = node.children ? filter(node.children) : [];

          const matches = node.name.toLowerCase().includes(search.toLowerCase());

          if (matches || children.length > 0) {
            return { ...node, children };
          }

          return null;
        })
        .filter(Boolean) as OrgNode[];

    return filter(orgTree);
  }, [search, orgTree]);

  /* ===================================================== */
  /* TREE NODE */
  /* ===================================================== */

  const TreeNode = memo(({ node }: { node: OrgNode }) => {
    const isTreeOpen = !!openNodes[node.id];
    const hasChildren = (node.children?.length || 0) > 0;

    const [showSlots, setShowSlots] = useState(true);
    const [lineStyle, setLineStyle] = useState<any>({});
    const childrenRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowSlots((prev) => !prev);
    };

    const groupedRoles = useMemo<RoleGroup[]>(() => {
      const roles = node.roles || [];
      const groups = new Map<string, OrgRole[]>();

      for (const role of roles) {
        const key = role.role || "Unknown";

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key)!.push(role);
      }

      return Array.from(groups.entries()).map(([role, slots]) => ({
        role,
        slots,
      }));
    }, [node.roles]);

    useEffect(() => {
      if (!isTreeOpen || !hasChildren || (node.children?.length || 0) < 2) return;

      const container = childrenRef.current;
      if (!container) return;

      const children = Array.from(
        container.querySelectorAll(":scope > .child-node")
      ) as HTMLElement[];

      if (children.length < 2) return;

      const first = children[0].getBoundingClientRect();
      const last = children[children.length - 1].getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();

      const left = first.left + first.width / 2 - parentRect.left;
      const right = last.left + last.width / 2 - parentRect.left;

      setLineStyle({
        left: `${left}px`,
        width: `${right - left}px`,
      });
    }, [isTreeOpen, hasChildren, node.children]);

    return (
      <div className="flex flex-col items-center">
        <div
          onClick={handleClick}
          className="
            px-6 py-3 min-w-[240px] text-center rounded-2xl cursor-pointer
            bg-gradient-to-br from-[#001a0f] to-[#000f08]
            border border-[#00ff66]/40
            backdrop-blur-md
            shadow-lg shadow-[#00ff66]/10
            text-[#00ff66]
            transition-all duration-200
            hover:-translate-y-1
            hover:shadow-xl hover:shadow-[#00ff66]/30
          "
        >
          {node.name}
        </div>

        <div
          className={`mt-4 flex flex-col items-center transition-all duration-300 ease-in-out overflow-hidden ${
            showSlots ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {groupedRoles.map((group, groupIndex) => {
            const assignedPeople = group.slots
              .map((slot) => {
                const slotId = slot.slotId?.toLowerCase();
                if (!slotId) return null;
                return slotMap[slotId] || null;
              })
              .filter(Boolean) as Personnel[];

            const emptyCount = group.slots.filter((slot) => {
              const slotId = slot.slotId?.toLowerCase();
              if (!slotId) return true;
              return !slotMap[slotId];
            }).length;

            return (
              <div
                key={`${group.role}-${groupIndex}`}
                className="mt-3 flex flex-col items-center"
              >
                <div className="text-[#00ff66] font-semibold mb-2">
                  {group.role}
                  {group.slots.length > 1 && (
                    <span className="text-gray-400 ml-2">×{group.slots.length}</span>
                  )}
                </div>

                {assignedPeople.map((person, i) => (
                  <div
                    key={`${person.id}-${i}`}
                    className="
                      w-[220px]
                      px-4 py-2 mb-2 rounded-xl text-center
                      bg-[#000f08]/80
                      border border-[#00ff66]/20
                    "
                  >
                    <span className="text-[#00ff66] font-bold">
                      {person.ranks?.name || "Unranked"}
                    </span>{" "}
                    <span className="text-white">{person.name}</span>
                  </div>
                ))}

                {Array.from({ length: emptyCount }).map((_, i) => (
                  <div
                    key={`empty-${group.role}-${i}`}
                    className="
                      w-[220px]
                      px-4 py-2 mb-2 rounded-xl text-center
                      bg-[#000a00]
                      border border-[#00ff66]/10
                    "
                  >
                    <span className="text-gray-500">Empty Slot</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {isTreeOpen && hasChildren && (
          <>
            <div className="w-[2px] h-6 bg-[#00ff66]" />

            <div
              ref={childrenRef}
              className="relative flex items-start justify-center"
            >
              {(node.children?.length || 0) > 1 && (
                <div
                  className="absolute top-0 h-[2px] bg-[#00ff66]"
                  style={lineStyle}
                />
              )}

              {node.children?.map((child) => (
                <div
                  key={child.id}
                  className="child-node flex flex-col items-center px-8"
                >
                  <div className="w-[2px] h-6 bg-[#00ff66]" />
                  <TreeNode node={child} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  });

  TreeNode.displayName = "TreeNode";

  /* ===================================================== */
  /* PAGE */
  /* ===================================================== */

  return (
    <main
      className="
        min-h-screen p-10 text-white
        bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]
      "
    >
      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <h1 className="text-4xl font-bold text-[#00ff66] mb-8">
        Grand ORBAT
      </h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="
            bg-black/40 backdrop-blur-sm
            border border-[#00ff66]/40
            px-4 py-2 rounded-lg
            text-[#00ff66]
            placeholder:text-[#00ff66]/40
            focus:border-[#00ff66]
            focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
            transition-all duration-300
          "
        />
      </div>

      <div className="overflow-hidden border border-[#00ff66]/40 rounded-3xl shadow-[0_0_40px_rgba(0,255,100,0.08)]">
        <TransformWrapper
          ref={transformRef}
          limitToBounds={false}
          smooth
          minScale={0.3}
          maxScale={3}
          wheel={{ step: 0.15 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent>
            <div
              ref={treeContainerRef}
              className="flex justify-center min-w-max p-10"
            >
              {filteredTree.map((node) => (
                <div key={node.id} className="px-12">
                  <TreeNode node={node} />
                </div>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </main>
  );
}