import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useCityStore } from '../../store/cityStore';
import { CITY_CENTER } from '../../lib/plotUtils';
import {
  buildMeshColliders,
  clampToMapBounds,
  findDriveSpawn,
  getBuildingFootprints,
  resolveBuildingCollisions,
  resolveInfrastructureCollision,
  sampleSurface,
} from '../../lib/collisionUtils';

const CAR_MODEL_URL = '/micro__car_v1__blue_enerald3d.glb';

const DRIVE = {
  maxSpeed: 30,
  reverseMaxSpeed: 10,
  acceleration: 13,
  brakeForce: 16,
  coastDrag: 3.2,
  steerRate: 2.1,
  steerSmoothing: 7,
  steerSpeedFactor: 0.35,
  bodyRoll: 0.045,
  collisionRadius: 2.3,
  groundOffset: 0.06,
  cameraDistance: 13,
  cameraHeight: 5.5,
  cameraLookAhead: 3.5,
  cameraSmoothing: 5.5,
  cameraYawSmoothing: 4,
};

const _forward = new THREE.Vector3();
const _cameraPos = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();

function CarModel({ scene }) {
  const car = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 4.6;
    const scale = targetLength / maxDim;
    clone.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    clone.position.y -= scaledBox.min.y;

    clone.rotation.y = Math.PI;
    return clone;
  }, [scene]);

  return <primitive object={car} />;
}

export function CarDriver({ infrastructureRoot }) {
  const { camera } = useThree();
  const { scene: carScene } = useGLTF(CAR_MODEL_URL);
  const cameraMode = useCityStore((s) => s.cameraMode);
  const setCameraMode = useCityStore((s) => s.setCameraMode);

  const carRef = useRef(null);
  const keys = useRef({});
  const speed = useRef(0);
  const steerInput = useRef(0);
  const steerAngle = useRef(0);
  const cameraYawOffset = useRef(0);
  const cameraPitch = useRef(0.28);
  const groundY = useRef(0);
  const spawned = useRef(false);
  const ambientRef = useRef(null);
  const ambientStopTimer = useRef(null);
  const footprints = useMemo(() => getBuildingFootprints(), []);
  const colliders = useMemo(
    () => (infrastructureRoot ? buildMeshColliders(infrastructureRoot) : []),
    [infrastructureRoot],
  );

  const [spawnX, , spawnZ] = CITY_CENTER;

  const stopAmbient = () => {
    const ambient = ambientRef.current;
    if (!ambient) return;

    if (ambientStopTimer.current) {
      clearTimeout(ambientStopTimer.current);
      ambientStopTimer.current = null;
    }

    ambient.pause();
    ambient.currentTime = 0;

    ambientRef.current = null;
  };

  const startAmbient = () => {
    if (ambientRef.current) {
      const currentAmbient = ambientRef.current;
      currentAmbient.volume = currentAmbient.dataset.targetVolume || currentAmbient.volume;
      currentAmbient.play().catch(() => {});
      return;
    }

    const ambient = new Audio('/audio/drive-ambient.mp3');
    ambient.loop = true;
    ambient.preload = 'auto';
    ambient.volume = 0.08;
    ambient.dataset.targetVolume = '0.08';

    ambient.addEventListener('error', () => {
      if (ambientRef.current === ambient) {
        ambientRef.current = null;
      }
    });

    ambient.play().catch(() => {});
    ambientRef.current = ambient;
  };

  useEffect(() => {
    if (cameraMode !== 'drive' || !colliders.length) return undefined;

    const placeCar = () => {
      if (!carRef.current) return false;
      const spawn = findDriveSpawn(colliders, spawnX, spawnZ);
      groundY.current = spawn.y;
      spawned.current = true;
      carRef.current.position.set(spawn.x, spawn.y + DRIVE.groundOffset, spawn.z);
      speed.current = 0;
      return true;
    };

    if (!placeCar()) {
      const frame = requestAnimationFrame(() => { placeCar(); });
      return () => cancelAnimationFrame(frame);
    }

    return undefined;
  }, [cameraMode, colliders, spawnX, spawnZ]);

  useEffect(() => {
    if (cameraMode !== 'drive') {
      spawned.current = false;
    }
  }, [cameraMode]);

  useEffect(() => {
    if (cameraMode !== 'drive') return undefined;

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      startAmbient();
      keys.current[key] = true;
      if (key === 'escape' || key === 'b') {
        setCameraMode('orbit');
      }
    };

    const onKeyUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    const onMouseMove = (event) => {
      if (document.pointerLockElement) {
        cameraYawOffset.current -= event.movementX * 0.0022;
        cameraPitch.current = THREE.MathUtils.clamp(
          cameraPitch.current - event.movementY * 0.0016,
          0.12,
          0.55,
        );
      }
    };

    const onClick = () => {
      startAmbient();
      if (cameraMode === 'drive' && !document.pointerLockElement) {
        document.body.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      stopAmbient();
      speed.current = 0;
      steerInput.current = 0;
      steerAngle.current = 0;
      cameraYawOffset.current = 0;
      cameraPitch.current = 0.28;
    };
  }, [cameraMode, setCameraMode]);

  useFrame((_, delta) => {
    if (cameraMode !== 'drive' || !carRef.current) return;

    if (!spawned.current && colliders.length) {
      const spawn = findDriveSpawn(colliders, spawnX, spawnZ);
      groundY.current = spawn.y;
      spawned.current = true;
      carRef.current.position.set(spawn.x, spawn.y + DRIVE.groundOffset, spawn.z);
    }

    const dt = Math.min(delta, 0.05);
    const car = carRef.current;

    const throttle = (keys.current.w || keys.current.arrowup) ? 1 : 0;
    const brake = (keys.current.s || keys.current.arrowdown) ? 1 : 0;
    const handbrake = keys.current[' '] ? 1 : 0;
    const steerLeft = (keys.current.a || keys.current.arrowleft) ? 1 : 0;
    const steerRight = (keys.current.d || keys.current.arrowright) ? 1 : 0;

    const targetSteer = steerLeft - steerRight;
    steerInput.current = THREE.MathUtils.lerp(
      steerInput.current,
      targetSteer,
      1 - Math.exp(-DRIVE.steerSmoothing * dt),
    );

    if (throttle > 0) {
      speed.current += DRIVE.acceleration * dt;
    } else if (brake > 0) {
      if (speed.current > 0.4) {
        speed.current -= DRIVE.brakeForce * dt;
      } else {
        speed.current -= DRIVE.acceleration * 0.55 * dt;
      }
    } else if (handbrake > 0) {
      speed.current = THREE.MathUtils.lerp(speed.current, 0, 1 - Math.exp(-DRIVE.brakeForce * 0.7 * dt));
    } else {
      const drag = speed.current > 0
        ? -DRIVE.coastDrag * dt
        : DRIVE.coastDrag * 0.35 * dt;
      speed.current = THREE.MathUtils.clamp(speed.current + drag, -DRIVE.reverseMaxSpeed, DRIVE.maxSpeed);
      if (Math.abs(speed.current) < 0.08) speed.current = 0;
    }

    speed.current = THREE.MathUtils.clamp(speed.current, -DRIVE.reverseMaxSpeed, DRIVE.maxSpeed);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(speed.current) / DRIVE.maxSpeed, 0.15, 1);
    if (ambientRef.current) {
      ambientRef.current.volume = 0.05 + speedFactor * 0.06;
    }
    const turnRate = DRIVE.steerRate * (DRIVE.steerSpeedFactor + (1 - DRIVE.steerSpeedFactor) * speedFactor);
    steerAngle.current += steerInput.current * turnRate * dt * Math.sign(speed.current || 1);
    steerAngle.current *= 1 - Math.exp(-2.5 * dt);

    car.rotation.y += steerInput.current * turnRate * dt * (speed.current / DRIVE.maxSpeed);

    _forward.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));

    const prevX = car.position.x;
    const prevZ = car.position.z;
    let nextX = prevX + _forward.x * speed.current * dt;
    let nextZ = prevZ + _forward.z * speed.current * dt;

    const currentSurface = sampleSurface(colliders, prevX, prevZ);
    const bodyY = currentSurface.y + 1.05;

    [nextX, nextZ] = resolveInfrastructureCollision(
      colliders,
      prevX,
      bodyY,
      prevZ,
      nextX,
      nextZ,
      DRIVE.collisionRadius,
    );

    [nextX, nextZ] = resolveBuildingCollisions(
      nextX,
      nextZ,
      DRIVE.collisionRadius,
      footprints,
    );

    [nextX, nextZ] = clampToMapBounds(nextX, nextZ);

    const moved = Math.hypot(nextX - prevX, nextZ - prevZ);
    if (moved < Math.abs(speed.current * dt) * 0.2 && Math.abs(speed.current) > 0.5) {
      speed.current *= 0.55;
    }

    const nextSurface = sampleSurface(colliders, nextX, nextZ);
    const targetY = nextSurface.y + DRIVE.groundOffset;
    groundY.current = THREE.MathUtils.lerp(groundY.current, targetY, 1 - Math.exp(-14 * dt));

    car.position.x = nextX;
    car.position.z = nextZ;
    car.position.y = groundY.current;
    car.rotation.z = THREE.MathUtils.lerp(
      car.rotation.z,
      -steerInput.current * DRIVE.bodyRoll * speedFactor,
      1 - Math.exp(-8 * dt),
    );

    const followYaw = car.rotation.y + cameraYawOffset.current;
    const camBack = DRIVE.cameraDistance * Math.cos(cameraPitch.current);
    const camUp = DRIVE.cameraHeight + DRIVE.cameraDistance * Math.sin(cameraPitch.current);

    _cameraPos.set(
      car.position.x - Math.sin(followYaw) * camBack,
      car.position.y + camUp,
      car.position.z - Math.cos(followYaw) * camBack,
    );

    _cameraTarget.set(
      car.position.x + Math.sin(car.rotation.y) * DRIVE.cameraLookAhead,
      car.position.y + 1.4,
      car.position.z + Math.cos(car.rotation.y) * DRIVE.cameraLookAhead,
    );

    const camLerp = 1 - Math.exp(-DRIVE.cameraSmoothing * dt);
    camera.position.lerp(_cameraPos, camLerp);
    camera.lookAt(_cameraTarget);
  });

  if (cameraMode !== 'drive') return null;

  return (
    <group ref={carRef} position={[spawnX, DRIVE.groundOffset, spawnZ]}>
      <CarModel scene={carScene} />
    </group>
  );
}

useGLTF.preload(CAR_MODEL_URL);
