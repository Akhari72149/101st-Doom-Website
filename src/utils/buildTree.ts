export function buildTree(nodes: any[]) {
  const map = new Map();

  // ✅ First pass — create node objects with depth = 0
  nodes.forEach((node) => {
    map.set(node.id, {
      ...node,
      depth: 0,
      children: [],
    });
  });

  const roots: any[] = [];

  // ✅ Second pass — attach children + assign depth properly
  nodes.forEach((node) => {
    const current = map.get(node.id);

    if (node.parent_id) {
      const parent = map.get(node.parent_id);

      if (parent) {
        // 🔥 Assign correct depth based on parent
        current.depth = parent.depth + 1;

        parent.children.push(current);
      }
    } else {
      roots.push(current);
    }
  });

  return roots;
}