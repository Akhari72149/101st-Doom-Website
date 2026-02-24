export function buildTree(nodes: any[]) {
  const map = new Map();

  nodes.forEach(node => {
    map.set(node.id, { ...node, children: [] });
  });

  const roots: any[] = [];

  nodes.forEach(node => {
    const current = map.get(node.id);

    if (node.parent_id) {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children.push(current);
      }
    } else {
      roots.push(current);
    }
  });

  return roots;
}