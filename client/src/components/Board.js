import { useEffect, useState } from 'react';
import styled, { css } from 'styled-components';

import socket from '../connect';

const Board = (props) => {
    const [grid, setGrid] = useState([]);
    
    useEffect(() => {
        setGrid(props.grid);
    }, [props.grid, grid]);

    const handlePlay = (e) => {
        socket.emit('play', e.target.id, function (error) {
            console.log(error);
        });
    }

    return (
        <Grid>
            {grid?.map((box, index) => {
                let isWin = box?.[2];
                return <Box onClick={handlePlay} id={index} key={index} active={isWin}>
                    {box?.map((circle, i) => circle && <Circle size={circle[1]} team={circle[0]} key={i} />)}
                </Box>
            })}
        </Grid>
    );
}

export default Board;

const Grid = styled.ul`
    display: grid;
    grid-template-columns: repeat(3, 16vmin);
    grid-template-rows: repeat(3, 16vmin);
    gap: 1rem;
`;

const Box = styled.li`
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    box-shadow: var(--box-shadow);
    border-radius: 1rem;

    ${props => props.active && css`
        background-color: var(--background-color-active);
    `}
`;

const Circle = styled.span`
    position: absolute;
    border-radius: 50%;
    padding: 0.3vmin;
    background: var(--gradient-color);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: destination-out;
    user-select: none;
    pointer-events: none;

    ${props => props.size === 'small' && css`
        height: 6vmin;
        width: 6vmin;
    `}

    ${props => props.size === 'medium' && css`
        height: 9vmin;
        width: 9vmin;
    `}

    ${props => props.size === 'large' && css`
        height: 12vmin;
        width: 12vmin;
    `}

    ${props => props.team === 'blue' && css`
        background: var(--gradient-blue);
    `}

    ${props => props.team === 'red' && css`
        background: var(--gradient-red);
    `}
`;