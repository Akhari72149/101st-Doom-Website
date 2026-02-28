"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { supabase } from "@/lib/supabase";
import { buildTree } from "@/utils/buildTree";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useRouter } from "next/navigation";


/* ===================================================== */
/* MAIN COMPONENT */
/* ===================================================== */

export default function GrandOrbat() {
  const router = useRouter();
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [personnel, setPersonnel] = useState<any[]>([]);

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

      const tree = buildTree(data || []);
      setOrgTree(tree);

      /* ✅ AUTO EXPAND EVERYTHING ON LOAD */
      const map: Record<string, boolean> = {};

      const expand = (nodes: any[]) => {
        nodes.forEach((node) => {
          map[node.id] = true;
          if (node.children?.length) expand(node.children);
        });
      };

      expand(tree);
      setOpenNodes(map);

      const { data: personnelData } = await supabase
        .from("personnel")
        .select("*, ranks(*)");

      setPersonnel(personnelData || []);
    }

    fetchData();
  }, []);

  /* ===================================================== */
  /*  MANUAL POSITION + SCALE ON LOAD */
  /* ===================================================== */

  useEffect(() => {
    if (!transformRef.current) return;

    const timer = setTimeout(() => {
      transformRef.current.setTransform(
        -200,    // X
        100,    // Y
        0.3,  // Scale
        800   // Animation duration
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [orgTree]);

  /* ===================================================== */
  /* SLOT MAP */
  /* ===================================================== */

  const slotMap = useMemo(() => {
    const map: Record<string, any[]> = {};

    personnel.forEach((person) => {
      if (!person.slotted_position) return;

      const key = person.slotted_position.toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(person);
    });

    return map;
  }, [personnel]);

  /* ===================================================== */
  /* TREE FILTER */
  /* ===================================================== */

  const filteredTree = useMemo(() => {
    if (!search.trim()) return orgTree;

    const filter = (nodes: any[]): any[] =>
      nodes
        .map((node) => {
          const children = node.children ? filter(node.children) : [];

          const matches = node.name
            .toLowerCase()
            .includes(search.toLowerCase());

          if (matches || children.length > 0) {
            return { ...node, children };
          }

          return null;
        })
        .filter(Boolean);

    return filter(orgTree);
  }, [search, orgTree]);

  /* ===================================================== */
  /* TREE NODE */
  /* ===================================================== */

  const TreeNode = memo(({ node }: any) => {
    const isTreeOpen = !!openNodes[node.id];
    const hasChildren = node.children?.length > 0;

    const [showSlots, setShowSlots] = useState(true);
    const [lineStyle, setLineStyle] = useState<any>({});
    const childrenRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowSlots((prev) => !prev);
    };

    useEffect(() => {
      if (!isTreeOpen || !hasChildren || node.children.length < 2) return;

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
    }, [isTreeOpen, node]);

    return (
      <div className="flex flex-col items-center">

        {/* NODE */}
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

        {/* SLOT PANEL */}
        <div
          className={`mt-4 flex flex-col items-center transition-all duration-300 ease-in-out overflow-hidden ${
            showSlots ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {node.roles?.map((role: any, roleIndex: number) => {
            const assigned = slotMap[role.slotId?.toLowerCase()] || [];
            const visible = assigned.slice(0, role.count);

            return (
              <div key={roleIndex} className="mt-3 flex flex-col items-center">
                <div className="text-[#00ff66] font-semibold mb-2">
                  {role.role}
                  {role.count > 1 && (
                    <span className="text-gray-400 ml-2">
                      ×{role.count}
                    </span>
                  )}
                </div>

                {visible.map((person: any, i: number) => (
                  <div
                    key={i}
                    className="
                      w-[220px]
                      px-4 py-2 mb-2 rounded-xl text-center
                      bg-[#000f08]/80
                      border border-[#00ff66]/20
                    "
                  >
                    <span className="text-[#00ff66] font-bold">
                      {person.ranks?.name}
                    </span>{" "}
                    <span className="text-white">
                      {person.name}
                    </span>
                  </div>
                ))}

                {Array.from({
                  length: role.count - visible.length,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="
                      w-[220px]
                      px-4 py-2 mb-2 rounded-xl text-center
                      bg-[#000a00]
                      border border-[#00ff66]/10
                    "
                  >
                    <span className="text-gray-500">
                      Empty Slot
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* CHILDREN */}
        {isTreeOpen && hasChildren && (
          <>
            <div className="w-[2px] h-6 bg-[#00ff66]" />

            <div
              ref={childrenRef}
              className="relative flex items-start justify-center"
            >
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 h-[2px] bg-[#00ff66]"
                  style={lineStyle}
                />
              )}

              {node.children.map((child: any) => (
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