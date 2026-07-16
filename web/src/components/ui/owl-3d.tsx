"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Nanny's owl head, extruded into real 3D from the vector mark.
 *
 * Two earlier passes tried to sculpt the mascot out of primitives — smooth
 * spheres, then faceted icosahedra. Both lost: the mark's character lives in a
 * specific arrangement of angular planes that no arrangement of stock solids
 * reproduces. So this doesn't reinterpret the art at all. It vectorises it and
 * gives every facet real depth, which keeps the design exactly as drawn while
 * making it something that can catch light and turn toward the cursor.
 *
 * Depth comes from paint order, not colour. An earlier version raised facets by
 * luminance, which buried the eyes: they are dark shapes sitting on top of the
 * pale facial disc, so "bright = forward" pushed the disc out in front of them.
 * The SVG already encodes what covers what — later paths are painted over
 * earlier ones — so stacking order is the depth order, and it is always right.
 */
const SVG_URL = "/owl-logo.svg";

/** Fills at or above this luminance are the artboard, not the owl. */
const BG_LUMA = 0.97;
/** How far the topmost facet sits in front of the backmost, in local units. */
const RELIEF = 58;

const subscribeNever = () => () => {};

function luminance(c: THREE.Color) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Pointer in normalised [-1, 1] space, tracked on the window rather than the
 *  canvas — the owl should follow the cursor across the whole hero, not only
 *  the box it happens to occupy. */
function usePointer(enabled: boolean) {
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  return target;
}

function OwlEmblem({ animate }: { animate: boolean }) {
  const root = useRef<THREE.Group>(null);
  const pointer = usePointer(animate);
  const data = useLoader(SVGLoader, SVG_URL);

  const { geometries, center, radius } = useMemo(() => {
    const out: { geometry: THREE.ExtrudeGeometry; color: THREE.Color }[] = [];

    // Drop the artboard first, so it doesn't consume a slice of the depth range.
    const paths = data.paths.filter((p) => luminance(p.color) < BG_LUMA);

    paths.forEach((path, i) => {
      // Every shape extrudes forward from a shared back plane, so a path painted
      // later ends up strictly in front of everything it covers in the drawing.
      const depth = 8 + (i / Math.max(1, paths.length - 1)) * RELIEF;
      // SVGLoader gives holes their correct winding, so shapes punch out cleanly.
      for (const shape of SVGLoader.createShapes(path)) {
        out.push({
          geometry: new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelThickness: 2.5,
            bevelSize: 2,
            bevelSegments: 1, // one segment = a hard chamfer, not a rounded edge
          }),
          color: path.color,
        });
      }
    });

    // Frame the mark: SVG is y-down and origin top-left, so the group gets
    // flipped and recentred rather than trusting the artboard's coordinates.
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    for (const { geometry } of out) {
      geometry.computeBoundingBox();
      if (geometry.boundingBox) box.union(tmp.copy(geometry.boundingBox));
    }
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    return { geometries: out, center: c, radius: Math.max(size.x, size.y) };
  }, [data]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;

    if (!animate) {
      root.current.rotation.set(0, 0, 0);
      root.current.position.y = 0;
      return;
    }

    // Follow the pointer. This is an extruded relief, not a full head — it has
    // no back — so the yaw stays inside the angle where that never shows.
    const yaw = pointer.current.x * 0.42;
    const pitch = pointer.current.y * 0.26;
    const damp = 1 - Math.pow(0.0018, delta); // frame-rate independent lerp

    root.current.rotation.y += (yaw - root.current.rotation.y) * damp;
    root.current.rotation.x += (pitch - root.current.rotation.x) * damp;

    // Idle float + a touch of counter-roll, so it hovers instead of bobbing.
    root.current.position.y = Math.sin(t * 1.1) * 0.05;
    root.current.rotation.z = Math.sin(t * 0.7) * 0.02;
  });

  // Normalise to ~2 units tall regardless of the artboard's pixel size.
  const scale = 2.05 / radius;

  return (
    <group ref={root}>
      <group scale={[scale, -scale, scale]} position={[0, 0, 0]}>
        <group position={[-center.x, -center.y, -center.z]}>
          {geometries.map(({ geometry, color }, i) => (
            <mesh key={i} geometry={geometry}>
              <meshStandardMaterial
                color={color}
                flatShading
                roughness={0.58}
                metalness={0.08}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

export function Owl3D({
  className = "",
  animate = true,
}: {
  className?: string;
  /** Set false to freeze the pose (used for reduced motion). */
  animate?: boolean;
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4.4], fov: 32 }}
      // The owl is decorative; the hero already announces itself in text.
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {/* Flat shading only reads if the lights disagree: a hard key to carve the
          chamfers, a violet rim to lift it off the aurora, and enough fill that
          the dark side never goes to black. */}
      <ambientLight intensity={0.7} color="#9d8cf0" />
      <directionalLight position={[-3, 3.5, 4]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[3.5, 0.5, 1]} intensity={1.6} color="#c084fc" />
      <pointLight position={[0, -2, 3]} intensity={2.0} color="#a855f7" />
      <Suspense fallback={null}>
        <OwlEmblem animate={animate} />
      </Suspense>
    </Canvas>
  );
}

/**
 * Mounts the canvas only after hydration and only when motion is welcome.
 * Callers render the PNG until this says otherwise, so the owl is never missing
 * — it simply stops being three-dimensional.
 */
export function useOwl3DReady() {
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true, // client
    () => false, // server
  );
  return mounted && !reduceMotion;
}
